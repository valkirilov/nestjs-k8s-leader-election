"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var LeaderElectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderElectionService = void 0;
const common_1 = require("@nestjs/common");
const client_node_1 = require("@kubernetes/client-node");
const event_emitter_1 = require("@nestjs/event-emitter");
const leader_election_options_interface_1 = require("./leader-election-options.interface");
let LeaderElectionService = LeaderElectionService_1 = class LeaderElectionService {
    constructor(options, eventEmitter) {
        var _a, _b, _c, _d, _e, _f;
        this.options = options;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(LeaderElectionService_1.name);
        this.isLeader = false;
        this.leaseRenewalTimeout = null;
        this.consecutiveFailures = 0;
        this.LEADER_IDENTITY = `nestjs-${process.env.HOSTNAME}`;
        const kubeConfig = new client_node_1.KubeConfig();
        kubeConfig.loadFromDefault();
        this.kubeClient = kubeConfig.makeApiClient(client_node_1.CoordinationV1Api);
        this.watch = new client_node_1.Watch(kubeConfig);
        this.leaseName = (_a = options.leaseName) !== null && _a !== void 0 ? _a : "nestjs-leader-election";
        this.namespace = (_b = options.namespace) !== null && _b !== void 0 ? _b : "default";
        this.renewalInterval = (_c = options.renewalInterval) !== null && _c !== void 0 ? _c : 10000;
        this.durationInSeconds = 2 * (this.renewalInterval / 1000);
        this.logAtLevel = (_d = options.logAtLevel) !== null && _d !== void 0 ? _d : "log";
        this.awaitLeadership = (_e = options.awaitLeadership) !== null && _e !== void 0 ? _e : false;
        this.maxConsecutiveFailures = (_f = options.maxConsecutiveFailures) !== null && _f !== void 0 ? _f : 3;
        process.on("SIGINT", () => this.gracefulShutdown());
        process.on("SIGTERM", () => this.gracefulShutdown());
    }
    onApplicationBootstrap() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!process.env.KUBERNETES_SERVICE_HOST) {
                this.logger[this.logAtLevel]("Not running in Kubernetes, assuming leadership...");
                this.isLeader = true;
                this.emitLeaderElectedEvent();
            }
            else {
                this.watchLeaseObject(); // This should start right away to catch any events.
                if (this.awaitLeadership) {
                    // If awaitLeadership is true, block until leader election is complete.
                    yield this.runLeaderElectionProcess();
                }
                else {
                    // Otherwise, run the leader election process in the background.
                    this.runLeaderElectionProcess().catch((error) => {
                        this.logger.error({
                            message: "Leader election process failed",
                            error,
                        });
                    });
                }
            }
        });
    }
    runLeaderElectionProcess() {
        return __awaiter(this, void 0, void 0, function* () {
            // Attempt to become a leader.
            yield this.tryToBecomeLeader();
            // If not successful, retry up to two more times.
            for (let attempt = 0; attempt < 2; attempt++) {
                if (this.isLeader)
                    break; // Break early if leadership is acquired.
                // Wait for half the lease duration before retrying.
                yield new Promise((resolve) => setTimeout(resolve, this.durationInSeconds * 500));
                // Try to become the leader again.
                yield this.tryToBecomeLeader();
            }
        });
    }
    tryToBecomeLeader() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger[this.logAtLevel]("Trying to become leader...");
            try {
                let lease = yield this.getLease();
                if (this.isLeaseExpired(lease) || !lease.spec.holderIdentity) {
                    this.logger[this.logAtLevel]("Lease expired or not held. Attempting to become leader...");
                    lease = yield this.acquireLease(lease);
                }
                if (this.isLeaseHeldByUs(lease)) {
                    this.becomeLeader();
                }
            }
            catch (error) {
                this.logger.error({
                    message: "Error while trying to become leader",
                    error,
                });
            }
        });
    }
    acquireLease(lease) {
        return __awaiter(this, void 0, void 0, function* () {
            // Set this instance as the holder of the lease
            lease.spec.holderIdentity = this.LEADER_IDENTITY;
            lease.spec.leaseDurationSeconds = this.durationInSeconds;
            lease.spec.acquireTime = new client_node_1.V1MicroTime(new Date());
            lease.spec.renewTime = new client_node_1.V1MicroTime(new Date());
            try {
                const { body } = yield this.kubeClient.replaceNamespacedLease(this.leaseName, this.namespace, lease);
                this.logger[this.logAtLevel]("Successfully acquired lease");
                return body;
            }
            catch (error) {
                this.logger.error({ message: "Error while acquiring lease", error });
                throw error;
            }
        });
    }
    renewLease() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Read the current lease state
                let lease = yield this.getLease();
                if (!this.isLeaseHeldByUs(lease)) {
                    this.logger.warn("Lease is no longer held by us. Losing leadership.");
                    this.loseLeadership();
                    return;
                }
                this.logger[this.logAtLevel]("Renewing lease...");
                lease.spec.renewTime = new client_node_1.V1MicroTime(new Date());
                // Try to renew the lease
                const { body } = yield this.kubeClient.replaceNamespacedLease(this.leaseName, this.namespace, lease);
                this.consecutiveFailures = 0; // Reset failure count on success
                this.logger[this.logAtLevel]("Successfully renewed lease");
                return body;
            }
            catch (error) {
                this.logger.error({ message: "Error while renewing lease", error });
                this.handleRenewalFailure(error);
                throw error; // Propagate for outer try-catch in scheduleLeaseRenewal
            }
        });
    }
    handleRenewalFailure(error) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.logger.error(`Failed to renew lease ${this.consecutiveFailures} times consecutively. Giving up leadership.`);
            this.loseLeadership();
        }
        else {
            this.logger.warn(`Failed to renew lease (${this.consecutiveFailures}/${this.maxConsecutiveFailures} failures). Will retry with exponential backoff.`);
            // Don't give up leadership yet - wait for next renewal attempt with backoff
        }
    }
    getLease() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { body } = yield this.kubeClient.readNamespacedLease(this.leaseName, this.namespace);
                return body;
            }
            catch (error) {
                if (error.response && error.response.statusCode === 404) {
                    this.logger[this.logAtLevel]("Lease not found. Creating lease...");
                    return this.createLease();
                }
                throw error;
            }
        });
    }
    createLease() {
        return __awaiter(this, void 0, void 0, function* () {
            const lease = {
                metadata: {
                    name: this.leaseName,
                    namespace: this.namespace,
                },
                spec: {
                    holderIdentity: this.LEADER_IDENTITY,
                    leaseDurationSeconds: this.durationInSeconds,
                    acquireTime: new client_node_1.V1MicroTime(new Date()),
                    renewTime: new client_node_1.V1MicroTime(new Date()),
                },
            };
            try {
                const { body } = yield this.kubeClient.createNamespacedLease(this.namespace, lease);
                this.logger[this.logAtLevel]("Successfully created lease");
                return body;
            }
            catch (error) {
                this.logger.error({ message: "Failed to create lease", error });
                throw error;
            }
        });
    }
    isLeaseExpired(lease) {
        const renewTime = lease.spec.renewTime
            ? new Date(lease.spec.renewTime).getTime()
            : 0;
        const leaseDurationMs = (lease.spec.leaseDurationSeconds || this.durationInSeconds) * 1000;
        return Date.now() > renewTime + leaseDurationMs;
    }
    isLeaseHeldByUs(lease) {
        return lease.spec.holderIdentity === this.LEADER_IDENTITY;
    }
    gracefulShutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger[this.logAtLevel]("Graceful shutdown initiated");
            if (this.isLeader) {
                yield this.releaseLease();
            }
        });
    }
    releaseLease() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let lease = yield this.getLease();
                if (lease && this.isLeaseHeldByUs(lease)) {
                    lease.spec.holderIdentity = null;
                    lease.spec.renewTime = null;
                    yield this.kubeClient.replaceNamespacedLease(this.leaseName, this.namespace, lease);
                    this.logger[this.logAtLevel](`Lease for ${this.leaseName} released.`);
                }
            }
            catch (error) {
                this.logger.error({ message: "Failed to release lease", error });
            }
        });
    }
    emitLeaderElectedEvent() {
        this.eventEmitter.emit(leader_election_options_interface_1.LeaderElectedEvent, { leaseName: this.leaseName });
        this.logger[this.logAtLevel](`Instance became the leader for lease: ${this.leaseName}`);
    }
    emitLeadershipLostEvent() {
        this.eventEmitter.emit(leader_election_options_interface_1.LeaderLostEvent, { leaseName: this.leaseName });
        this.logger[this.logAtLevel](`Instance lost the leadership for lease: ${this.leaseName}`);
    }
    becomeLeader() {
        this.isLeader = true;
        this.consecutiveFailures = 0; // Reset failure count when becoming leader
        this.emitLeaderElectedEvent();
        this.scheduleLeaseRenewal();
    }
    loseLeadership() {
        if (this.isLeader) {
            this.isLeader = false;
            if (this.leaseRenewalTimeout) {
                clearTimeout(this.leaseRenewalTimeout);
                this.leaseRenewalTimeout = null;
            }
            this.emitLeadershipLostEvent();
        }
    }
    watchLeaseObject() {
        return __awaiter(this, void 0, void 0, function* () {
            const path = `/apis/coordination.k8s.io/v1/namespaces/${this.namespace}/leases`;
            try {
                yield this.watch.watch(path, {}, (type, apiObj, watchObj) => {
                    if (apiObj && apiObj.metadata.name === this.leaseName) {
                        this.logger[this.logAtLevel](`Watch event type: ${type} for lease: ${this.leaseName}`);
                        switch (type) {
                            case "ADDED":
                            case "MODIFIED":
                                setTimeout(() => this.handleLeaseUpdate(apiObj), 2000);
                                break;
                            case "DELETED":
                                setTimeout(() => this.handleLeaseDeletion(), 2000);
                                break;
                        }
                    }
                }, (err) => {
                    if (err) {
                        this.logger.error({
                            message: `Watch for lease ended with error: ${err}, trying again in 5 seconds`,
                            error: err,
                        });
                    }
                    else {
                        this.logger[this.logAtLevel]("Watch for lease gracefully closed");
                    }
                    // Restart the watch after a delay
                    setTimeout(() => this.watchLeaseObject(), 5000);
                });
            }
            catch (err) {
                this.logger.error(`Failed to start watch for lease: ${err}, trying again in 5 seconds`);
                // Retry starting the watch after a delay
                setTimeout(() => this.watchLeaseObject(), 5000);
            }
        });
    }
    scheduleLeaseRenewal() {
        // Clear any existing lease renewal timeout.
        if (this.leaseRenewalTimeout) {
            clearTimeout(this.leaseRenewalTimeout);
            this.leaseRenewalTimeout = null;
        }
        // Don't schedule if we're not the leader
        if (!this.isLeader) {
            return;
        }
        // Calculate delay with exponential backoff based on consecutive failures
        // 0 failures: renewalInterval (10s)
        // 1 failure:  renewalInterval * 2 (20s)
        // 2 failures: renewalInterval * 4 (40s)
        const backoffMultiplier = Math.pow(2, this.consecutiveFailures);
        const delayMs = this.renewalInterval * backoffMultiplier;
        this.logger[this.logAtLevel](`Scheduling next lease renewal in ${delayMs}ms (failures: ${this.consecutiveFailures})`);
        // Schedule the lease renewal
        this.leaseRenewalTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            if (this.isLeader) {
                try {
                    yield this.renewLease();
                }
                catch (error) {
                    // Error already logged in renewLease
                }
                // Schedule next renewal if still leader
                if (this.isLeader) {
                    this.scheduleLeaseRenewal();
                }
            }
        }), delayMs);
    }
    handleLeaseUpdate(leaseObj) {
        if (this.isLeaseHeldByUs(leaseObj)) {
            if (!this.isLeader) {
                setTimeout(() => {
                    this.becomeLeader();
                }, 2000); // Wait for 2 seconds before becoming the leader
            }
            this.scheduleLeaseRenewal();
        }
        else if (this.isLeader) {
            this.loseLeadership();
        }
    }
    handleLeaseDeletion() {
        if (!this.isLeader) {
            this.tryToBecomeLeader().catch((error) => {
                this.logger.error({
                    message: "Error while trying to become leader after lease deletion",
                    error,
                });
            });
        }
    }
};
exports.LeaderElectionService = LeaderElectionService;
exports.LeaderElectionService = LeaderElectionService = LeaderElectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("LEADER_ELECTION_OPTIONS")),
    __metadata("design:paramtypes", [Object, event_emitter_1.EventEmitter2])
], LeaderElectionService);
