// D1（env.DB）から製品とレビューを読み出す。
// バインディングはwrangler.jsoncで宣言してあるので、
// APIキーやエンドポイントURLはコードのどこにも出てこない。
import { env } from "cloudflare:workers";

export type Product = {
	id: string;
	name: string;
	category: string;
	price: number;
	description: string;
};

export type Review = {
	id: number;
	product_id: string;
	rating: number;
	body: string;
	created_at: string;
};

export async function listProducts(): Promise<Product[]> {
	const { results } = await env.DB.prepare(
		"SELECT id, name, category, price, description FROM products WHERE published = 1 ORDER BY id",
	).all<Product>();

	return results;
}

export async function getProduct(id: string): Promise<Product | null> {
	return await env.DB.prepare(
		"SELECT id, name, category, price, description FROM products WHERE id = ?1 AND published = 1",
	)
		.bind(id)
		.first<Product>();
}

export async function listReviews(productId: string): Promise<Review[]> {
	const { results } = await env.DB.prepare(
		"SELECT id, product_id, rating, body, created_at FROM reviews WHERE product_id = ?1 ORDER BY id DESC",
	)
		.bind(productId)
		.all<Review>();

	return results;
}
