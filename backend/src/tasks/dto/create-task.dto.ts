import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;
}
