// レビュー投稿の受け口。フォームからPOSTされる
export const prerender = false;

import type { APIRoute } from "astro";
import { addReview, getProduct } from "../../lib/catalog";
import { reviewProcessor } from "../../lib/review-processor";

export const POST: APIRoute = async ({ request, redirect }) => {
	const form = await request.formData();
	const productId = String(form.get("product_id") ?? "");
	const rating = Number(form.get("rating"));
	const input = String(form.get("body") ?? "");

	const product = await getProduct(productId);
	if (!product) {
		return new Response("製品が見つかりません", { status: 404 });
	}

	// 別のWorkerの関数を、JavaScriptのメソッドと同じ感覚で呼び出す（RPC）。
	// URLもアクセストークンも書かずに済むのがサービスバインディングの利点。
	const body = await reviewProcessor.sanitize(input);

	if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body === "") {
		return redirect(`/products/${productId}/?error=invalid`, 303);
	}

	if (await reviewProcessor.isSpam(body)) {
		// ダッシュボードのログで絞り込めるように、オブジェクトで出力しておく
		console.log({ event: "review_rejected", reason: "spam", productId });
		return redirect(`/products/${productId}/?error=spam`, 303);
	}

	await addReview({ productId, rating, body });

	console.log({ event: "review_posted", productId, rating });

	return redirect(`/products/${productId}/?posted=1`, 303);
};
