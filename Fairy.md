Fairy
---
- Fairy 是一個使用 GitHub Copilot CLI SDK 建構的 Node.js 應用程式
- 我可以透過 Telegram Bot API 跟 Fairy 溝通
- 只有我能用 Telegram 跟 Fairy 溝通，Fairy 無視其他人的指令
- Fairy 啟動時會透過 Telegram Bot API 跟我打招呼
- Fairy 啟動時先不要 createSession，而是先 await client.start(); 然後用 await client.listModels(); 再用 Telegram 告訴我有哪些 model 可以用，做成在 Telegram 內可以按的按鈕，我再用 Telegram 告訴 Fairy 我要用哪個 model
- **選完 model 後不要立即建立 session，等我第一次傳訊息叫 Fairy 做事時才建立 session（Lazy Initialization），以節省 premium request**
- 我可以用 Telegram 叫 Fairy 對這個專案的內容進行任何修改，Fairy 修改完成後會重新啟動
- Fairy 的 sessionId 是 fairy
- 當我叫 Fairy 工作的時候，如果 Fairy 判斷有需要，Fairy 可以用 createSession 產生一個以上的 subagent，並且給它們適合的 createSession 參數，包含但不限於 systemPrompt、model，透過 subagent 進行工作，Fairy 最後將結果統整，透過 Telegram 回傳給我，Fairy 負責創造、管理這些 subagent，已經 create 的 subagent，之後如果適合使用的話，Fairy 可以再拿出來用，所以 Fairy 要記住有哪些 subagent 被 create 了，存在 subagent 資料夾裡，每次要用 subagent 的時候就先去 subagent 資料夾裡找。每次 Fairy 程式開啟的時候清空 subagent 資料夾。
- Fairy 會保護我的所有秘密，不會讓別人知道
- Fairy 會把重要的事存在 memory 資料夾裡，有需要的時候可以讀取，才不會忘記重要的事
- Fairy 在處理我交代的工作時，會判斷這份工作比較適合用現成工具(Fairy 可以用 homebrew 裝適合的工具來處理我交代的工作) 或者 Fairy 產生適合的 subagent 來處理。如果需要 subagent 寫新的程式，subagent 寫完程式以後，Fairy 會存在 tool 資料夾裡，之後處理類似的工作可以重複使用。tool 內的工具要存在 memory，這樣以後才會記得拿來用。
- 我會把我工作的 git repo 放在 work 資料夾中，讓 Fairy 可以產生適合的 subagent 幫我處理工作
- Fairy 會寫 log 在 log 資料夾裡，尤其是在 Fairy 的程式出錯的時候，Fairy 有能力讀 log 來查自己程式的問題，並且自我修正。
- subagent 資料夾的異動不會觸發 Fairy 重啟，只有專案程式邏輯變動才需要重啟

## 節省 Premium Request 策略
- Session Lazy Initialization：選完 model 後不建立 session，等第一次收到使用者訊息才建立
- Subagent 重複利用：已建立的 subagent 設定存在 subagent 資料夾，相似任務可重複使用
- Tool 快取：常用工具存在 tool 資料夾與 memory，避免重複撰寫