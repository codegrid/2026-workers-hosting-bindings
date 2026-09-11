// Workers Analytics Engine（env.ANALYTICS）にアクセスを記録する。
// 書き込みはバインディング経由で、戻り値を待つ必要がない（fire-and-forget）。
import { env } from "cloudflare:workers";

export function recordProductView(input: {
	productId: string;
	category: string;
	country: string;
}): void {
	env.ANALYTICS.writeDataPoint({
		// 文字列は blobs に入れる
		blobs: [input.productId, input.category, input.country],
		// 数値は doubles に入れる。集計時に SUM(double1) で閲覧数になる
		doubles: [1],
		// サンプリングの基準になるキー。1データポイントにつき1つだけ指定できる
		indexes: [input.productId],
	});
}
