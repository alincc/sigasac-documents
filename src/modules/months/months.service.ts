import { Injectable, Inject } from '@nestjs/common';
import { Repository, In } from 'typeorm';

import { MONTH_REPOSITORY } from 'src/config';
import { DatesHelper } from 'src/utils/helpers';

import { Month } from './months.entity';
import { MonthDto, ClosedMonthDto } from './dto';

@Injectable()
export class MonthsService {
    constructor(
        @Inject(MONTH_REPOSITORY)
        private readonly month: Repository<Month>
    ) {}

    async create(monthDto: MonthDto) {
        try {
            return await this.month.save(monthDto);
        } catch (error) {
            throw error;
        }
    }

    async getBySchool(schoolId: number) {
        try {
            return await this.month
                .createQueryBuilder('m')
                .leftJoinAndSelect('m.state', 'state')
                .leftJoinAndSelect('m.modificationRequest', 'mr')
                .leftJoinAndSelect('mr.requestStatus', 'rs')
                .where('m.schoolId = :schoolId', { schoolId })
                .getMany();
        } catch (error) {
            throw error;
        }
    }

    async closed(id: number, closedMonthDto: ClosedMonthDto) {
        try {
            const month = await this.month.findOne({ where: { id } });

            let newMonth: Month;

            if (month) {
                month.stateId = closedMonthDto.stateId;
                month.finishDate = closedMonthDto.finishDate;
                month.closedBy = closedMonthDto.closedBy;

                await this.month.save(month);

                newMonth = await this.month.save({
                    startDate: new Date(
                        DatesHelper.addMonthToDate(month.startDate)
                    ),
                    schoolId: month.schoolId
                });
            }

            return newMonth;
        } catch (error) {
            throw error;
        }
    }

    async getBySchoolId(schoolId: number) {
        try {
            return (
                this.month
                    .createQueryBuilder('m')
                    .where('m.schoolId = :schoolId', { schoolId })
                    .andWhere('m.state = 2')
                    // .orWhere('m.state = 3')
                    .getMany()
            );
        } catch (error) {
            throw error;
        }
    }
}
