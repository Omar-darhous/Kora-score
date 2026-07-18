// اختبار جلب البيانات من واجهات ESPN للتحقق من الاتصال وعمل الخدمات
async function test() {
  try {
    const urls = [
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
      'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings',
      'https://sports.core.api.espn.com/v2/sports/soccer/leagues'
    ];

    for (let url of urls) {
      const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`URL: ${url} -> Status: ${res.status}`);
    }
  } catch(e) {
    console.error("ERROR:", e);
  }
}

test();
