# Phase 3: メッセージ画面改善（計画のみ）

Phase 2 完了・Preview 確認後に着手する予定の作業メモ。本ドキュメントは実装を含まない。

## 目的

メッセージ／チャット関連 UI で、空状態・エラー・権限問題を隠さず、ユーザーが次のアクションを取れるようにする。

## 改善項目

1. **フォロー 0 人**
   - フォロー中ユーザーがいない場合、ユーザー検索・フォロー方法を案内する（既存の `UserSearchSheet` / コミュニティ導線と整合）。

2. **会話 0 件**
   - メッセージ一覧が空のとき、会話を始める手順（投稿者への問い合わせ、プロフィールからメッセージ等）を表示。

3. **通信エラー**
   - ネットワーク失敗に応じた説明と `common.retry` 等の再試行ボタン。
   - `firestoreListenErrors` や既存エラーキー（例: `errors.messagesLoadFailed`）の実装・配線を確認し、未使用キーを UI に接続。

4. **Firebase 権限エラー**
   - `permission-denied` 等の実原因をログ／UI で区別し、サインイン状態・ルール・オフライン等に応じた案内（Firebase ルール変更は別タスクで調査）。

5. **読み込みの実検証**
   - エラー表示を「見せるだけ」で終わらせず、再試行後にリスナーが正常復帰するか確認するフローをテスト。

6. **i18n**
   - 日本語および既存 20 言語のキー parity（`tests/i18n-parity.test.mjs`）を維持。

## 主な触りそうなファイル（参考）

- `src/components/TrafficMessagesSheet.tsx`
- `src/hooks/useMessageInboxSummary.ts`（およびメッセージ Firestore リスナー）
- `src/assets/lib/firestoreListenErrors.ts`（存在・利用状況の確認）
- `src/i18n/locales/*.json`

## 受け入れの目安

- 各空状態・エラー状態でスクリーンショット可能な明確な UI。
- Preview / 実機で再試行が機能すること。
- Phase 2 と同様、`npm run build` と i18n parity テストが通ること。
