import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "modules/database/database.service";
import { DemoDataService } from "modules/database/demo-data.service";

@Global()
@Module({
  providers: [DatabaseService, DemoDataService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
