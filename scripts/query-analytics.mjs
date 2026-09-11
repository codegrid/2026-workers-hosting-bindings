// Analytics Engineに溜めたデータを集計する。
//
// 書き込みはバインディングでできるが、読み取りだけはバインディングがなく、
// HTTPのSQL APIを叩く。つまりアカウントIDとAPIトークンが必要になる。
//
//   CLOUDFLARE_ACCOUNT_ID=xxxx CLOUDFLARE_API_TOKEN=xxxx node scripts/query-analytics.mjs
//
// トークンは「Account Analytics: Read」の権限があるものを発行する。

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !apiToken) {
	console.error("CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_API_TOKEN を環境変数で渡してください。");
	process.exit(1);
}

// blob1 = 製品ID、blob3 = 国、double1 = 1アクセス。
// サンプリングされている場合に備えて _sample_interval を掛けて数える。
const query = `
  SELECT
    blob1 AS product_id,
    SUM(_sample_interval * double1) AS views
  FROM catalog_views
  WHERE timestamp > NOW() - INTERVAL '7' DAY
  GROUP BY product_id
  ORDER BY views DESC
`;

const response = await fetch(
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
	{
		method: "POST",
		headers: { Authorization: `Bearer ${apiToken}` },
		body: query,
	},
);

if (!response.ok) {
	console.error(`${response.status} ${response.statusText}`);
	console.error(await response.text());
	process.exit(1);
}

const { data } = await response.json();

for (const row of data) {
	console.log(`${row.product_id}\t${row.views}`);
}
