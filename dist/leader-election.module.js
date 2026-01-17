"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LeaderElectionModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderElectionModule = void 0;
const common_1 = require("@nestjs/common");
const leader_election_service_1 = require("./leader-election.service");
const leader_election_options_interface_1 = require("./leader-election-options.interface");
let LeaderElectionModule = LeaderElectionModule_1 = class LeaderElectionModule {
    static forRoot(options) {
        return {
            module: LeaderElectionModule_1,
            providers: [
                {
                    provide: leader_election_options_interface_1.LEADER_ELECTION_OPTIONS,
                    useValue: options,
                },
                leader_election_service_1.LeaderElectionService,
            ],
            exports: [leader_election_service_1.LeaderElectionService],
        };
    }
    static forRootAsync(options) {
        return {
            module: LeaderElectionModule_1,
            providers: [
                {
                    provide: leader_election_options_interface_1.LEADER_ELECTION_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                leader_election_service_1.LeaderElectionService,
            ],
            exports: [leader_election_service_1.LeaderElectionService],
        };
    }
};
exports.LeaderElectionModule = LeaderElectionModule;
exports.LeaderElectionModule = LeaderElectionModule = LeaderElectionModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], LeaderElectionModule);
