const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// 初始化 Firebase Admin 權限
admin.initializeApp();

// 設定每天早上 08:00 自動執行
exports.sendTeamsExpiryAlert = onSchedule({
    schedule: "every day 08:00",
    timeZone: "Asia/Taipei",
}, async (event) => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 撈取庫存資料
    const snapshot = await db.collection("inventory").get();
    let urgentItems = [];

    snapshot.forEach(doc => {
        const item = doc.data();
        const qty = parseInt(item.quantity) || 0;
        
        if (qty > 0) {
            const expiryDate = new Date(item.expiry);
            expiryDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            // 篩選 14 天內即期或已過期的商品
            if (diffDays <= 14) {
                urgentItems.push({
                    name: item.name,
                    batch: item.batchNo || "N/A",
                    qty: qty,
                    days: diffDays < 0 ? "已過期 " + Math.abs(diffDays) + " 天" : `剩餘 ${diffDays} 天`
                });
            }
        }
    });

    // 如果沒有即期品，就不發送通知
    if (urgentItems.length === 0) {
        console.log("🎉 今日無即期品，不發送推播。");
        return;
    }

    // 組合 Teams 的訊息內容
    let messageText = `🚨 **【門市每日即期品自動快報】**\n\n`;
    urgentItems.forEach((item, index) => {
        messageText += `${index + 1}. **${item.name}** (批號: ${item.batch}) - 庫存: ${item.qty}件 - ⏳ *${item.days}*\n`;
    });

    // 你的 Power Automate Webhook 網址
    const teamsWebhookUrl = "Https://default9ec0d6c58a25418fb3841c77c55584.c2.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/b0b034afd62f430fb12bf33cc8919fad/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=_gGsjPcQvJ-_Loyy5K4O7bv0XDFq43PDeTxaILokiZE";

    // 發送 POST 請求給 Teams
    try {
        const response = await fetch(teamsWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: messageText })
        });
        console.log("✅ Teams 即期提醒發送成功！狀態碼:", response.status);
    } catch (error) {
        console.error("❌ Teams 通知發送失敗:", error);
    }
});
