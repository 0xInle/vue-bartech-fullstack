import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";

class MetaResponseDto {
  @ApiProperty({ example: "IndieBar API" })
  name!: string;

  @ApiProperty({ example: "1.0.0" })
  version!: string;
}

@ApiTags("meta")
@Controller("meta")
export class MetaController {
  @Get()
  @ApiOperation({ summary: "Получить безопасную информацию о версии API" })
  @ApiOkResponse({ type: MetaResponseDto })
  getMeta(): MetaResponseDto {
    return { name: "IndieBar API", version: "1.0.0" };
  }
}
