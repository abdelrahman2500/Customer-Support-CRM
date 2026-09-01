import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateQuickReplyDto } from "./dto/create-quick-reply.dto";
import { UpdateQuickReplyDto } from "./dto/update-quick-reply.dto";
import type { QuickReplySummary } from "./quick-replies.service";
import { QuickRepliesService } from "./quick-replies.service";

/** Story 91 — branch-admin resource. `quick-reply:read` also gates the
 * everyday list an agent's `ChatComposer` picker fetches — a real
 * deployment grants it to the `Agent` role via the existing Role/
 * Permission admin UI, the same way it would grant `ticket:read` today. */
@ApiTags("channels")
@ApiBearerAuth()
@Controller("quick-replies")
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Post()
  @RequirePermissions("quick-reply:create")
  create(@Body() dto: CreateQuickReplyDto): Promise<QuickReplySummary> {
    return this.quickRepliesService.createQuickReply(dto);
  }

  @Get()
  @RequirePermissions("quick-reply:read")
  list(): Promise<QuickReplySummary[]> {
    return this.quickRepliesService.listQuickReplies();
  }

  @Patch(":id")
  @RequirePermissions("quick-reply:update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateQuickReplyDto,
  ): Promise<{ id: string }> {
    return this.quickRepliesService.updateQuickReply(id, dto);
  }
}
