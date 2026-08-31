import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectDto, ReorderDto, TaskDto, UpdateProjectDto, UpdateTaskDto, WorkLogDto } from './projects.dto';

@Controller()
export class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Get('projects') list(@CurrentUser() u: AuthUser, @Query('businessTypeId') businessTypeId?: string, @Query('departmentId') departmentId?: string, @Query('status') status?: string) { return this.svc.list(u, { businessTypeId, departmentId, status }); }
  @Post('projects') create(@CurrentUser() u: AuthUser, @Body() d: ProjectDto) { return this.svc.create(u, d); }
  @Post('projects/reorder') reorder(@CurrentUser() u: AuthUser, @Body() d: ReorderDto) { return this.svc.reorder(u, d.ids); }
  @Get('projects/:id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.get(u, id); }
  @Patch('projects/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateProjectDto) { return this.svc.update(u, id, d); }
  @Delete('projects/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('reason') reason?: string) { return this.svc.remove(u, id, reason); }

  @Get('projects/:id/tasks') tasks(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.listTasks(u, id); }
  @Post('projects/:id/tasks') createTask(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: TaskDto) { return this.svc.createTask(u, id, d); }
  @Get('tasks/my') my(@CurrentUser() u: AuthUser, @Query('scope') scope?: string, @Query('userId') userId?: string) { return this.svc.myTasks(u, { scope, userId }); }

  // 일일 업무 일지 — 본인 작성, 대표는 전체 열람
  @Get('worklogs') worklogs(@CurrentUser() u: AuthUser, @Query('date') date?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('scope') scope?: string, @Query('userId') userId?: string) { return this.svc.workLogs(u, { date, from, to, scope, userId }); }
  @Put('worklogs') setWorklog(@CurrentUser() u: AuthUser, @Body() d: WorkLogDto) { return this.svc.setWorkLog(u, d.date, d.content); }
  @Patch('tasks/:taskId') updateTask(@CurrentUser() u: AuthUser, @Param('taskId') id: string, @Body() d: UpdateTaskDto) { return this.svc.updateTask(u, id, d); }
  @Delete('tasks/:taskId') removeTask(@CurrentUser() u: AuthUser, @Param('taskId') id: string) { return this.svc.removeTask(u, id); }
}
