import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly CACHE_KEY = 'tasks:all';
  private readonly ttl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Default TTL is 60 seconds if REDIS_TTL is not provided
    this.ttl = Number(this.configService.get<number>('REDIS_TTL', 60));
  }

  /**
   * Fetch all tasks.
   * Checks Redis cache first.
   * On HIT: returns parsed JSON tasks and logs CACHE HIT.
   * On MISS: queries PostgreSQL via Prisma, saves to Redis with TTL, logs CACHE MISS.
   */
  async findAll() {
    // 1. Check Redis for cached tasks
    const cachedData = await this.redisService.get(this.CACHE_KEY);

    if (cachedData) {
      console.log('CACHE HIT');
      this.logger.log(`CACHE HIT: Loaded tasks from Redis key "${this.CACHE_KEY}"`);
      return JSON.parse(cachedData);
    }

    // 2. Cache miss: Fetch from PostgreSQL
    console.log('CACHE MISS');
    this.logger.log(`CACHE MISS: Fetching tasks from PostgreSQL and caching with TTL ${this.ttl}s`);

    const tasks = await this.prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 3. Save to Redis with TTL
    await this.redisService.set(this.CACHE_KEY, JSON.stringify(tasks), this.ttl);

    return tasks;
  }

  /**
   * Create a new task.
   * Saves to PostgreSQL and invalidates the task-list cache.
   */
  async create(dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
      },
    });

    // Invalidate cache
    await this.invalidateCache();
    this.logger.log(`Created task #${task.id}. Cache invalidated.`);

    return task;
  }

  /**
   * Mark a task as completed.
   * Verifies task exists, updates completed to true, and invalidates cache.
   */
  async markAsCompleted(id: number) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { completed: true },
    });

    // Invalidate cache
    await this.invalidateCache();
    this.logger.log(`Marked task #${id} as completed. Cache invalidated.`);

    return updatedTask;
  }

  /**
   * Delete a task.
   * Verifies task exists, deletes it, and invalidates cache.
   */
  async delete(id: number) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    await this.prisma.task.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache();
    this.logger.log(`Deleted task #${id}. Cache invalidated.`);

    return { message: `Task with ID ${id} successfully deleted` };
  }

  /**
   * Invalidate the task-list cache in Redis
   */
  private async invalidateCache() {
    await this.redisService.del(this.CACHE_KEY);
    this.logger.log(`Invalidated Redis cache for key "${this.CACHE_KEY}"`);
  }
}
