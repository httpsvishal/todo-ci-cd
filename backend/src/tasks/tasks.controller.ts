import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * GET /tasks
   * Retrieves all tasks with Redis caching
   */
  @Get()
  async getTasks() {
    return this.tasksService.findAll();
  }

  /**
   * POST /tasks
   * Creates a new task and invalidates cache
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  /**
   * PATCH /tasks/:id/complete
   * Marks a task as completed and invalidates cache
   */
  @Patch(':id/complete')
  async completeTask(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.markAsCompleted(id);
  }

  /**
   * DELETE /tasks/:id
   * Deletes a task and invalidates cache
   */
  @Delete(':id')
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.delete(id);
  }
}
