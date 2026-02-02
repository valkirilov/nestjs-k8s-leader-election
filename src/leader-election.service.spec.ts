import { Test, TestingModule } from "@nestjs/testing";
import { LeaderElectionService } from "./leader-election.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  KubeConfig,
  CoordinationV1Api,
  V1Lease,
  V1MicroTime,
} from "@kubernetes/client-node";
import type { IncomingMessage } from "http";

jest.mock("@kubernetes/client-node");

type K8sResponse<T> = {
  response: IncomingMessage;
  body: T;
};

describe("LeaderElectionService", () => {
  let service: LeaderElectionService;
  let mockKubeClient: jest.Mocked<CoordinationV1Api>;
  let setTimeoutSpy: jest.SpyInstance;

  const mockLease: V1Lease = {
    metadata: {
      name: "test-lease",
      namespace: "test-namespace",
    },
    spec: {
      holderIdentity: `nestjs-${process.env.HOSTNAME}`,
      leaseDurationSeconds: 20,
      acquireTime: new V1MicroTime(new Date()),
      renewTime: new V1MicroTime(new Date()),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    setTimeoutSpy = jest.spyOn(global, "setTimeout");

    mockKubeClient = {
      readNamespacedLease: jest.fn(),
      replaceNamespacedLease: jest.fn(),
      createNamespacedLease: jest.fn(),
    } as any;

    const mockKubeConfig = {
      loadFromDefault: jest.fn(),
      makeApiClient: jest.fn().mockReturnValue(mockKubeClient),
    } as Partial<KubeConfig>;

    (KubeConfig as jest.MockedClass<typeof KubeConfig>).mockImplementation(
      () => mockKubeConfig as KubeConfig,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderElectionService,
        EventEmitter2,
        {
          provide: "LEADER_ELECTION_OPTIONS",
          useValue: {
            leaseName: "test-lease",
            namespace: "test-namespace",
            renewalInterval: 10000,
            logAtLevel: "debug",
            awaitLeadership: false,
            maxConsecutiveFailures: 3,
          },
        },
      ],
    }).compile();

    service = module.get<LeaderElectionService>(LeaderElectionService);

    delete process.env.KUBERNETES_SERVICE_HOST;
  });

  afterEach(() => {
    jest.useRealTimers();
    setTimeoutSpy.mockRestore();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("Lease Renewal Logic", () => {
    beforeEach(() => {
      service["isLeader"] = true;
      service["consecutiveFailures"] = 0;
    });

    it("should successfully renew lease and reset failure counter", async () => {
      service["consecutiveFailures"] = 2;
      mockKubeClient.readNamespacedLease.mockResolvedValue({
        body: mockLease,
      } as K8sResponse<V1Lease>);
      mockKubeClient.replaceNamespacedLease.mockResolvedValue({
        body: mockLease,
      } as K8sResponse<V1Lease>);

      await service["renewLease"]();

      expect(service["consecutiveFailures"]).toBe(0);
    });

    it("should lose leadership if lease is held by another instance", async () => {
      const leaseHeldByOther: V1Lease = {
        ...mockLease,
        spec: { ...mockLease.spec, holderIdentity: "other-instance" },
      };
      mockKubeClient.readNamespacedLease.mockResolvedValue({
        body: leaseHeldByOther,
      } as K8sResponse<V1Lease>);

      await service["renewLease"]();

      expect(service["isLeader"]).toBe(false);
      expect(mockKubeClient.replaceNamespacedLease).not.toHaveBeenCalled();
    });

    it("should track failures and lose leadership after maxConsecutiveFailures", async () => {
      mockKubeClient.readNamespacedLease.mockResolvedValue({
        body: mockLease,
      } as K8sResponse<V1Lease>);
      mockKubeClient.replaceNamespacedLease.mockRejectedValue(
        new Error("Network error"),
      );

      // Failures 1 and 2 - should maintain leadership
      await expect(service["renewLease"]()).rejects.toThrow();
      expect(service["consecutiveFailures"]).toBe(1);
      expect(service["isLeader"]).toBe(true);

      await expect(service["renewLease"]()).rejects.toThrow();
      expect(service["consecutiveFailures"]).toBe(2);
      expect(service["isLeader"]).toBe(true);

      // Failure 3 - should lose leadership
      await expect(service["renewLease"]()).rejects.toThrow();
      expect(service["consecutiveFailures"]).toBe(3);
      expect(service["isLeader"]).toBe(false);
    });

    it("should apply exponential backoff when scheduling renewals", () => {
      const tests = [
        { failures: 0, expectedDelay: 10000 },
        { failures: 1, expectedDelay: 20000 },
        { failures: 2, expectedDelay: 40000 },
      ];

      tests.forEach(({ failures, expectedDelay }) => {
        service["consecutiveFailures"] = failures;
        service["scheduleLeaseRenewal"]();
        expect(setTimeoutSpy).toHaveBeenLastCalledWith(
          expect.any(Function),
          expectedDelay,
        );
        setTimeoutSpy.mockClear();
      });
    });

    it("should continue scheduling renewals while leader", async () => {
      mockKubeClient.readNamespacedLease.mockResolvedValue({
        body: mockLease,
      } as K8sResponse<V1Lease>);
      mockKubeClient.replaceNamespacedLease.mockResolvedValue({
        body: mockLease,
      } as K8sResponse<V1Lease>);

      service["scheduleLeaseRenewal"]();
      const callback = setTimeoutSpy.mock.calls[0][0];
      await callback();

      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    });
  });
});
