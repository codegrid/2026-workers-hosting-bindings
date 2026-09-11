# Workersのバインディングとログ機能

CodeGridの連載「Cloudflare Workersで作るWebサイトのホスティング」第4回のサンプルです。Astroで作った架空の文具メーカーのサイト（会社概要＋製品カタログ＋レビュー投稿）に、Cloudflareのサービスをバインディングでぶら下げていきます。

記事の話題を1ステップずつコミットに分けていますので、`git log`を追いながら、どのファイルがどの段階で変わったのかを確認できます。

## 何がどこに繋がっているか

| サービス | バインディング | 役割 |
| :--- | :--- | :--- |
| D1 | `env.DB` | 製品とレビューのマスタ |
| KV | `env.CATALOG` | 表示用に整形したカタログのキャッシュ |
| Analytics Engine | `env.ANALYTICS` | 製品ページの閲覧記録 |
| 別のWorker（RPC） | `env.REVIEW_PROCESSOR` | レビュー本文の下ごしらえ |

いずれも`wrangler.jsonc`に宣言してあるだけで、APIキーもエンドポイントURLもコードには出てきません。唯一の例外がAnalytics Engineの**読み取り**で、こちらはバインディングがなくSQL APIにトークン付きでPOSTします（`scripts/query-analytics.mjs`）。

## コミットの流れ

| コミット | 内容 | 記事の対応箇所 |
| :--- | :--- | :--- |
| `Initial commit from Astro` | `npm create astro@latest`（minimalテンプレート） | － |
| Cloudflareアダプターを追加して… | `astro add cloudflare`と、生成される`wrangler.jsonc` | － |
| D1をバインディングして… | `d1_databases`の宣言、`env.DB`でのSQL実行、カタログページ | wrangler.jsoncに宣言する／D1 |
| KVをバインディングして… | `kv_namespaces`の宣言、整形済みカタログのキャッシュ | KV |
| レビュー投稿を追加して… | D1への書き込みと、KVキャッシュの削除 | KV（結果整合性の話） |
| レビュー処理を別Workerに… | `services`の宣言と`WorkerEntrypoint`、RPC呼び出し | コラム：Workerから別のWorkerをバインドする |
| Analytics Engineに… | `analytics_engine_datasets`の宣言、`writeDataPoint` | アクセス集計のためのAnalytics Engine |
| Observabilityを設定して… | `observability`と`head_sampling_rate`、構造化ログ | ログとトレース |
| 本番用の環境を追加する | 既定の設定を開発用とし、`env.prod`を追加 | コラム：環境ごとにWorker/バインディングを用意する |

## 動かし方

依存パッケージをインストールします。

```
npm install
```

ローカル用のD1にテーブルと初期データを流し込みます。ローカルの状態は`.wrangler/`以下に保存されるので、Cloudflareのアカウントがなくても動きます。

```
npm run db:migrate
```

開発サーバーを起動します。Astro 7のCloudflareアダプターはCloudflare Vite Pluginを使うため、`astro dev`でもWorkersのランタイム（workerd）がそのまま動きます。RPCの呼び出し先である`review-processor`も、`astro.config.mjs`の`auxiliaryWorkers`の指定によって一緒に起動します。

```
npm run dev
```

- `/` ……会社概要。静的に生成されるページ
- `/products/` ……製品カタログ。KVにキャッシュがあればKVから、なければD1から組み立てる
- `/products/mn-01/` ……製品の詳細とレビュー。フォームから投稿すると、RPC経由でサニタイズしてD1に保存する

一覧ページには、そのリクエストでKVとD1のどちらから読んだかを表示しています。1回目は`D1`、2回目以降は`KV`になり、レビューを投稿するとキャッシュが消えてまた`D1`に戻る、という動きが確認できます。

## 自分のアカウントにデプロイする

`wrangler.jsonc`の一番上に書いてあるバインディングが開発用（既定）で、`env.prod`が本番用です。環境を指定しなければ開発用になるので、うっかり本番に向けてしまうことがありません。

| | Worker名 | D1 | Analytics Engine |
| :--- | :--- | :--- | :--- |
| 既定（開発用） | `2026-workers-hosting-bindings-dev` | `codegrid-demo-dev` | `catalog_views_dev` |
| `env.prod` | `2026-workers-hosting-bindings` | `codegrid-demo` | `catalog_views` |

`database_id`とKVの`id`はダミーの値です。次のように自分のアカウントでリソースを作り、出力されたIDに置き換えてください（開発用と本番用で別々に作ります）。

```
npx wrangler d1 create codegrid-demo-dev
npx wrangler kv namespace create CATALOG
```

Analytics Engineのデータセットは、事前の作成が不要です。`wrangler.jsonc`に名前を書いて`writeDataPoint`を呼べば、そのタイミングで作られます。

デプロイと、リモートのD1へのマイグレーションは次のとおりです。スクリプトの中で、RPC先のWorkerを先にデプロイしています。

```
npm run deploy        # 開発用
npm run deploy:prod   # 本番用

npm run db:migrate:dev
npm run db:migrate:prod
```

本番用を指定するのは、Astroのビルドでは環境変数`CLOUDFLARE_ENV`です。Cloudflare Vite Pluginを使う構成では、`wrangler deploy --env prod`ではバインディングが切り替わらない点に注意してください（サイト側のWorkerの設定は、ビルド時に`dist/`へ書き出されるためです）。RPC先のWorkerはVite Pluginを通らないので、そちらは通常どおり`--env prod`で指定します。

## Analytics Engineの集計

書き込みと違い、読み取りにはアカウントIDとAPIトークン（Account Analytics: Read）が必要です。

```
CLOUDFLARE_ACCOUNT_ID=xxxx CLOUDFLARE_API_TOKEN=xxxx node scripts/query-analytics.mjs
```

## 補足

`worker-configuration.d.ts`は自動生成されるファイルのため、リポジトリには含めていません。型が必要な場合は次のコマンドで生成できます。

```
npm run generate-types
```

このコマンドが生成する`env.REVIEW_PROCESSOR`の型は、中身のない`Service`です。呼び出し先のメソッドを型付きで呼ぶために、`src/lib/review-processor.ts`で呼び出し先クラスの型を当てています。

架空の会社・製品によるサンプルです。レビュー投稿は誰でも書き込める状態になっていますので、そのまま公開して運用するものではありません。
