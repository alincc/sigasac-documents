import {
    Injectable,
    Inject,
    ConflictException,
    NotFoundException
} from '@nestjs/common';

import { Repository, getConnection } from 'typeorm';

import {
    BUDGET_NOTE_REPOSITORY,
    BUDGET_NOTE_DETAIL_REPOSITORY
} from 'src/config';

import { ApproverReviewerService } from '../approver-reviewer/approver-reviewer.service';
import { MonthsService } from 'src/modules/months/months.service';

import { BudgetNote } from './budget-notes.entity';
import { BudgetNotesDetail } from './budget-notes-detail.entity';

import { BudgetNoteDto, BudgetNoteDetailDto } from './dto';

@Injectable()
export class BudgetNotesService {
    constructor(
        @Inject(BUDGET_NOTE_REPOSITORY)
        private readonly budgetNote: Repository<BudgetNote>,
        @Inject(BUDGET_NOTE_DETAIL_REPOSITORY)
        private readonly budgetNoteDetail: Repository<BudgetNotesDetail>,
        private readonly monthsService: MonthsService,
        private readonly approverReviewerService: ApproverReviewerService
    ) {}

    async create(budgetNoteDto: BudgetNoteDto) {
        try {
            const months = await this.monthsService.getBySchoolId(
                budgetNoteDto.schoolId
            );

            if (!months.length) {
                throw new ConflictException(
                    'No hay periodos creados o abiertos actualmente para la institución'
                );
            }

            const {
                approverId,
                reviewerId
            } = await this.approverReviewerService.getOnlyActives(
                budgetNoteDto.schoolId
            );

            budgetNoteDto.monthId = months[0].id;

            budgetNoteDto.totalAmount = budgetNoteDto.budgetNotesDetail
                .map(d => d.value)
                .reduce((acc, cur) => acc + cur);

            budgetNoteDto.approverId = approverId;
            budgetNoteDto.reviewerId = reviewerId;

            const _budgetNote = await this.budgetNote.save(budgetNoteDto);

            await this.budgetNoteDetail.save(
                this.addBudgetIdToBudgetNotesDetail(
                    _budgetNote.id,
                    budgetNoteDto.budgetNotesDetail
                )
            );

            return _budgetNote;
        } catch (error) {
            throw error;
        }
    }

    private addBudgetIdToBudgetNotesDetail(
        budgetNoteId: number,
        budgetNotesDetail: BudgetNoteDetailDto[]
    ) {
        const _budgetNotesDetail: BudgetNoteDetailDto[] = [];

        for (let budgetNoteDetail of budgetNotesDetail) {
            budgetNoteDetail.budgetNoteId = budgetNoteId;

            _budgetNotesDetail.push(budgetNoteDetail);
        }

        return _budgetNotesDetail;
    }

    async nullyfy(schoolId: number, id: number) {
        try {
            const _budgetNote = await this.budgetNote.findOne({
                where: { id, schoolId }
            });

            if (_budgetNote) {
                _budgetNote.state = 0;
                await this.budgetNote.save(_budgetNote);
            }

            if (!_budgetNote) {
                throw new NotFoundException(
                    `No existe el documento solicitado`
                );
            }
        } catch (error) {
            throw error;
        }
    }

    async update(
        schoolId: number,
        id: number,
        budgetNotesDetailDto: BudgetNoteDetailDto[]
    ) {
        try {
            const _budgetNote = await this.budgetNote.findOne({
                where: { id, schoolId }
            });

            // eliminar detalle
            if (_budgetNote) {
                await getConnection()
                    .createQueryBuilder()
                    .delete()
                    .from(BudgetNotesDetail)
                    .where('budgetNoteId = :budgetNoteId', {
                        budgetNoteId: _budgetNote.id
                    })
                    .execute();

                _budgetNote.totalAmount = budgetNotesDetailDto
                    .map(d => d.value)
                    .reduce((acc, cur) => acc + cur);

                await this.budgetNote.save(_budgetNote);

                await this.budgetNoteDetail.save(
                    this.addBudgetIdToBudgetNotesDetail(
                        _budgetNote.id,
                        budgetNotesDetailDto
                    )
                );
            }
        } catch (error) {
            throw error;
        }
    }

    async getAll(schoolId: number) {
        try {
            return await this.budgetNote
                .createQueryBuilder('bn')
                .leftJoinAndSelect('bn.month', 'month')
                .leftJoinAndSelect('bn.concept', 'concept')
                .leftJoinAndSelect('bn.subconcept', 'subconcept')
                .leftJoinAndSelect('bn.budgetNotesDetail', 'bnd')
                .leftJoinAndSelect('bnd.budgetAccount', 'budgetAccount')
                .leftJoinAndSelect('bnd.campus', 'campus')
                .leftJoinAndSelect('bnd.revenue', 'revenue')
                .leftJoinAndSelect('bnd.project', 'project')
                .where('bn.schoolId = :schoolId', { schoolId })
                .getMany();
        } catch (error) {
            throw error;
        }
    }
}
