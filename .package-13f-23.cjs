
const fs=require('fs');
const file='src/main/ipc/register-campaign-ipc.ts';
if(!fs.existsSync(file)) throw new Error('Dosya bulunamadi: '+file);
fs.copyFileSync(file,`${file}.before-package-13f-23.bak`);
let s=fs.readFileSync(file,'utf8');

const fn='function reportCampaignPerformanceSnapshot(): void';
if(!s.includes(fn)){
 const marker='function reportCampaignFailureDistribution(): void';
 const idx=s.indexOf(marker);
 if(idx===-1) throw new Error('13F-22 gerekli.');
 const add=`function reportCampaignPerformanceSnapshot(): void {
  const database=getDatabase();
  try{
    const values=database.prepare(\`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM campaigns
    \`).get();

    const recipients=database.prepare(\`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN('sent','delivered','read') THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
      FROM campaign_recipients
    \`).get();

    console.info(
      \`[Campaign Engine] Snapshot: kampanya toplam=\${Number(values.total||0)}, completed=\${Number(values.completed||0)}, running=\${Number(values.running||0)}, scheduled=\${Number(values.scheduled||0)}, failed=\${Number(values.failed||0)}, cancelled=\${Number(values.cancelled||0)}.\`
    );

    console.info(
      \`[Campaign Engine] Snapshot: alıcı toplam=\${Number(recipients.total||0)}, başarılı=\${Number(recipients.success||0)}, başarısız=\${Number(recipients.failed||0)}.\`
    );
  }catch(e){
    console.error('[Campaign Engine] Snapshot oluşturulamadı: '+(e instanceof Error?e.message:String(e)));
  }
}

`;
 s=s.slice(0,idx)+add+s.slice(idx);
}

if(!s.includes('  reportCampaignPerformanceSnapshot();')){
 const anchor='  reportCampaignFailureDistribution();';
 const i=s.indexOf(anchor);
 if(i===-1) throw new Error('Çağrı bulunamadı.');
 s=s.slice(0,i+anchor.length)+'\n  reportCampaignPerformanceSnapshot();'+s.slice(i+anchor.length);
}

fs.writeFileSync(file,s,'utf8');
console.log('13F-23 uygulandi');
