"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const leader_election_service_1 = require("./leader-election.service");
const event_emitter_1 = require("@nestjs/event-emitter");
describe("LeaderElectionService", () => {
    let service;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        const module = yield testing_1.Test.createTestingModule({
            providers: [
                leader_election_service_1.LeaderElectionService,
                event_emitter_1.EventEmitter2, // Assuming we're using EventEmitter2 directly
                {
                    provide: "LEADER_ELECTION_OPTIONS",
                    useValue: {
                        leaseName: "test-lease",
                        namespace: "test-namespace",
                        renewalInterval: 10000,
                    },
                },
            ],
        }).compile();
        service = module.get(leader_election_service_1.LeaderElectionService);
    }));
    it("should be defined", () => {
        expect(service).toBeDefined();
    });
});
