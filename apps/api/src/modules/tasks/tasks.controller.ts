import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated } from "../../common/pagination/paginated";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import type { TaskSummary } from "./tasks.service";
import { TasksService } from "./tasks.service";

/**
 * RM-03 — deliberately no `@RequirePermissions` on any route: a task is
 * always the requesting agent's own, never a branch-admin resource —
 * mirrors `NotificationPreferencesController`'s exact rationale. Every
 * route still requires standard authentication (the global `AuthGuard`/
 * `AudienceGuard` stack applies regardless).
 */
@ApiTags("tasks")
@ApiBearerAuth()
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto): Promise<TaskSummary> {
    return this.tasksService.createTask(dto);
  }

  @Get()
  list(@Query() query: ListTasksQueryDto): Promise<Paginated<TaskSummary>> {
    return this.tasksService.listTasks(query);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto): Promise<{ id: string }> {
    return this.tasksService.updateTask(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ id: string }> {
    return this.tasksService.deleteTask(id);
  }
}
