import { DynamicModule } from '@nestjs/common';
import { LeaderElectionOptions } from './leader-election-options.interface';
export declare class LeaderElectionModule {
    static forRoot(options: LeaderElectionOptions): DynamicModule;
    static forRootAsync(options: {
        useFactory: (...args: any[]) => Promise<LeaderElectionOptions> | LeaderElectionOptions;
        inject?: any[];
    }): DynamicModule;
}
