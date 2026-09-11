// レビュー投稿の受け口。フォームからPOSTされる
export const prerender = false;

import type { APIRoute } from "astro";
import { addReview, getProduct } from "../../lib/catalog";

export const POST: APIRoute = async ({ request, redirect }) => {
	const form = await request.formData();
	const productId = String(form.get("product_id") ?? "");
	const rating = Number(form.get("rating"));
	const body = String(form.get("body") ?? "").trim();

	const product = await getProduct(productId);
	if (!product) {
		return new Response("製品が見つかりません", { status: 404 });
	}

	if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body === "") {
		return redirect(`/products/${productId}/?error=invalid`, 303);
	}

	await addReview({ productId, rating, body });

	return redirect(`/products/${productId}/?posted=1`, 303);
};
