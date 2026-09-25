import { Module } from "@nestjs/common";
import { PayrollController } from "modules/payroll/payroll.controller";
import { PayrollService } from "modules/payroll/payroll.service";

@Module({
  controllers: [PayrollController],
  providers: [PayrollService]
})
export class PayrollModule {}
