// レビュー本文の下ごしらえだけを担当するWorker。
// サイト側のWorkerからは、サービスバインディング（RPC）で呼び出される。
// HTTPのエンドポイントではないので、URLもアクセストークンも登場しない。
import { WorkerEntrypoint } from "cloudflare:workers";

const MAX_LENGTH = 300;
const SPAM_WORDS = ["今すぐ購入", "副業", "http://bit.ly"];

export class ReviewProcessor extends WorkerEntrypoint {
	// HTMLタグや制御文字を落とし、長さを揃える
	sanitize(text: string): string {
		return text
			.replace(/<[^>]*>/g, "")
			.replace(/[\u0000-\u001f\u007f]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, MAX_LENGTH);
	}

	// リンクだらけの投稿や、NGワードを含む投稿をはじく
	isSpam(text: string): boolean {
		const links = text.match(/https?:\/\//g) ?? [];
		if (links.length >= 2) {
			return true;
		}

		return SPAM_WORDS.some((word) => text.includes(word));
	}
}

// RPCで呼び出す前提のWorkerなので、HTTPで直接叩かれたときは何も返さない
export default {
	fetch() {
		return new Response("This Worker is called via RPC.", { status: 404 });
	},
} satisfies ExportedHandler;
