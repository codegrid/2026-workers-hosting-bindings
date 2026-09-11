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

// 一覧の表示に必要なものだけを持たせた、整形済みのカタログ
export type CatalogItem = {
	id: string;
	name: string;
	category: string;
	priceLabel: string;
	description: string;
	reviewCount: number;
	averageRating: number | null;
};

const CATALOG_KEY = "catalog:v1";
const CATALOG_TTL = 60 * 10; // 10分

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

// マスタであるD1から、一覧表示用のデータを組み立てる。
// 製品とレビューを結合して集計するので、アクセスのたびに実行したい処理ではない。
export async function buildCatalog(): Promise<CatalogItem[]> {
	const { results } = await env.DB.prepare(
		`SELECT
       p.id, p.name, p.category, p.price, p.description,
       COUNT(r.id) AS review_count,
       AVG(r.rating) AS average_rating
     FROM products p
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE p.published = 1
     GROUP BY p.id
     ORDER BY p.id`,
	).all<Product & { review_count: number; average_rating: number | null }>();

	return results.map((row) => ({
		id: row.id,
		name: row.name,
		category: row.category,
		priceLabel: `${row.price.toLocaleString("ja-JP")}円`,
		description: row.description,
		reviewCount: row.review_count,
		averageRating: row.average_rating === null ? null : Math.round(row.average_rating * 10) / 10,
	}));
}

// 整形済みのカタログをKV（env.CATALOG）にキャッシュする。
// 読み取りが圧倒的に多く、多少古くても困らないデータなのでKVが向いている。
export async function getCatalog(): Promise<{ items: CatalogItem[]; source: "KV" | "D1" }> {
	const cached = await env.CATALOG.get<CatalogItem[]>(CATALOG_KEY, "json");
	if (cached) {
		return { items: cached, source: "KV" };
	}

	const items = await buildCatalog();
	await env.CATALOG.put(CATALOG_KEY, JSON.stringify(items), {
		expirationTtl: CATALOG_TTL,
	});

	return { items, source: "D1" };
}

// レビューが増えたら平均評価が変わるので、キャッシュを消して作り直させる。
// ただしKVは結果整合性なので、全世界のエッジに反映されるまでには時間差がある。
export async function invalidateCatalog(): Promise<void> {
	await env.CATALOG.delete(CATALOG_KEY);
}
