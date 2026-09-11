// RPCで呼び出す別Workerへのバインディング。
// `wrangler types`が生成する型は中身のない Service なので、
// 呼び出し先のクラスの型を当てて、メソッドを型付きで呼べるようにしておく。
import { env } from "cloudflare:workers";

import type { ReviewProcessor } from "../../workers/review-processor/src/index";

export const reviewProcessor = env.REVIEW_PROCESSOR as unknown as Service<typeof ReviewProcessor>;
