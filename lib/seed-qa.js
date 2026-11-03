'use strict';

/**
 * Starter content for the FAQ and "before we visit" pages, written in all four languages.
 * It is inserted once when the tables are empty and can be edited or deleted from the admin.
 * Only general guidance: no prices, no response times, no promises about specific jobs.
 */
module.exports = [
  // ---------- FAQ ----------
  {
    kind: 'faq',
    ko: { q: '어느 지역까지 출장을 나가나요?', a: '서울 지역을 중심으로 출장을 나가고 있어요. 홈페이지 지도에서 현재 서비스 가능한 구를 확인하실 수 있고, 가능 여부가 궁금하시면 전화나 문의로 지역을 알려 주세요.' },
    en: { q: 'Which areas do you visit?', a: 'We mainly work in Seoul. You can see the districts we currently serve on the map on our home page. If you are not sure, call us or send a message with your area.' },
    zh: { q: '你们可以上门服务哪些地区？', a: '我们主要在首尔地区上门服务。您可以在首页的地图上查看目前可服务的区。如果不确定，请来电或留言告知您所在的地区。' },
    ja: { q: 'どの地域まで出張しますか？', a: '主にソウル市内へ出張しています。現在対応しているエリアはホームページの地図でご確認いただけます。ご不明な場合は、お電話またはお問い合わせでお住まいの地域をお知らせください。' },
  },
  {
    kind: 'faq',
    ko: { q: '비용은 어떻게 되나요?', a: '작업 종류, 제품, 현장 상황, 출장 지역에 따라 달라져요. 전화나 문의로 상황을 알려 주시면 작업 전에 안내해 드립니다.' },
    en: { q: 'How much does it cost?', a: 'It depends on the type of work, the product, the situation on site and your area. Call us or send a message describing your situation and we will explain before any work starts.' },
    zh: { q: '费用是多少？', a: '费用会因作业类型、产品、现场情况和上门地区而不同。请来电或留言告知您的情况，我们会在作业前为您说明。' },
    ja: { q: '料金はどのくらいですか？', a: '作業の種類、製品、現場の状況、出張先の地域によって異なります。お電話またはお問い合わせで状況をお知らせいただければ、作業前にご案内します。' },
  },
  {
    kind: 'faq',
    ko: { q: '문이 잠겼는데, 문을 부수지 않고 열 수 있나요?', a: '도어락과 문의 종류, 잠긴 상황에 따라 달라서 상황을 확인한 뒤 가능한 방법을 안내해 드려요. 먼저 전화로 현재 상태를 알려 주세요.' },
    en: { q: "I'm locked out. Can you open the door without damaging it?", a: 'It depends on the type of lock and door and on how it got locked. We will check the situation and tell you which options are possible. Please call us first and describe what is happening.' },
    zh: { q: '我被锁在门外了，可以不破坏门就打开吗？', a: '这取决于门锁和门的类型以及被锁的具体情况。我们会先确认情况，再告知可行的方法。请先来电说明目前的状况。' },
    ja: { q: '鍵がかかって入れません。扉を壊さずに開けられますか？', a: 'ドアロックや扉の種類、閉まった状況によって異なります。状況を確認したうえで、可能な方法をご案内します。まずはお電話で現在の状態をお知らせください。' },
  },
  {
    kind: 'faq',
    ko: { q: '도어락이 갑자기 열리지 않거나 소리만 나요. 고장인가요?', a: '배터리가 방전되어 생기는 경우가 많아요. 새 배터리로 교체해 보시고, 그래도 해결되지 않으면 도어락 모델명과 증상을 알려 주세요.' },
    en: { q: "My door lock suddenly won't open or only beeps. Is it broken?", a: 'A drained battery is a common cause. Try replacing the batteries, and if the problem remains, tell us the lock model and what happens.' },
    zh: { q: '门锁突然打不开，或者只发出提示音，是坏了吗？', a: '很多时候是电池没电了。请先更换新电池，如果仍然无法解决，请告知门锁型号和具体症状。' },
    ja: { q: 'ドアロックが急に開かず、音だけ鳴ります。故障でしょうか？', a: '電池切れが原因の場合が多いです。新しい電池に交換してみて、それでも解決しない場合は、ドアロックの型番と症状をお知らせください。' },
  },
  {
    kind: 'faq',
    ko: { q: '구매해 둔 도어락 제품이 있는데, 설치만 해 주실 수 있나요?', a: '설치 가능 여부는 제품 모델과 문의 상태에 따라 달라져요. 제품 모델명과 문 종류를 알려 주시면 확인해 드립니다.' },
    en: { q: 'I already bought a door lock. Can you just install it?', a: 'Whether we can install it depends on the model and the condition of the door. Tell us the model name and the type of door and we will check.' },
    zh: { q: '我已经买了门锁，可以只请你们安装吗？', a: '能否安装取决于产品型号和门的状态。请告知产品型号和门的类型，我们会为您确认。' },
    ja: { q: '購入済みのドアロックがあります。設置だけお願いできますか？', a: '設置できるかどうかは、製品の型番や扉の状態によって異なります。型番と扉の種類をお知らせいただければ確認します。' },
  },
  {
    kind: 'faq',
    ko: { q: '열쇠는 어떤 종류든 복사할 수 있나요?', a: '열쇠 종류에 따라 가능 여부가 달라서 먼저 어떤 열쇠인지 확인해야 해요. 문의하실 때 열쇠의 모양이나 표시된 문구를 알려 주세요.' },
    en: { q: 'Can you copy any kind of key?', a: 'It depends on the type of key, so we need to see what kind it is first. When you contact us, tell us the shape of the key or any marking on it.' },
    zh: { q: '任何类型的钥匙都可以复制吗？', a: '能否复制取决于钥匙的类型，需要先确认是哪一种钥匙。咨询时请告知钥匙的形状或上面的标记文字。' },
    ja: { q: 'どんな種類の鍵でも複製できますか？', a: '鍵の種類によって可否が異なるため、まずどの種類の鍵かを確認する必要があります。お問い合わせの際に、鍵の形や刻印されている文字をお知らせください。' },
  },

  // ---------- before we visit ----------
  {
    kind: 'guide',
    ko: { q: '현재 상황을 간단히 정리해 주세요', a: '도어락이 아예 켜지지 않는지, 켜지지만 열리지 않는지, 열쇠가 없어 들어가지 못하는 상황인지 등 지금 상태를 간단히 정리해 두시면 상담이 빨라져요.' },
    en: { q: 'Briefly describe what is happening', a: 'Does the lock not turn on at all, turn on but not open, or are you locked out without a key? A short description of the situation makes the call much faster.' },
    zh: { q: '请先简单整理目前的状况', a: '是门锁完全没反应、有反应但打不开，还是没有钥匙进不了门？先简单整理一下当前状态，可以让咨询更快。' },
    ja: { q: '現在の状況を簡単にまとめてください', a: 'ドアロックがまったく反応しないのか、反応するが開かないのか、鍵がなくて入れないのか。今の状態を簡単にまとめておくと、ご相談がスムーズです。' },
  },
  {
    kind: 'guide',
    ko: { q: '배터리부터 확인해 보세요', a: '번호키 도어락은 배터리가 방전되어 작동하지 않는 경우가 많아요. 새 배터리로 교체해 보시고, 그래도 해결되지 않으면 연락해 주세요.' },
    en: { q: 'Check the batteries first', a: 'Keypad door locks often stop working because the batteries are drained. Try new batteries, and if that does not help, get in touch with us.' },
    zh: { q: '请先检查电池', a: '密码门锁常常因为电池耗尽而无法工作。请先换上新电池，如果仍然无法解决，请与我们联系。' },
    ja: { q: 'まず電池を確認してください', a: '暗証番号式のドアロックは、電池切れで動かなくなることがよくあります。新しい電池に交換してみて、それでも解決しない場合はご連絡ください。' },
  },
  {
    kind: 'guide',
    ko: { q: '도어락 모델과 문 종류를 확인해 주세요', a: '도어락 표면에 적힌 제조사와 모델명, 문의 재질(철문·목문 등)과 두께를 알려 주시면 필요한 부품과 작업 방식을 미리 준비할 수 있어요.' },
    en: { q: 'Check the lock model and the type of door', a: 'If you can tell us the brand and model printed on the lock, and the door material (steel, wood, etc.) and thickness, we can prepare the right parts and method in advance.' },
    zh: { q: '请确认门锁型号和门的类型', a: '如果能告知门锁表面标注的品牌和型号，以及门的材质（铁门、木门等）和厚度，我们就可以提前准备所需的部件和作业方式。' },
    ja: { q: 'ドアロックの型番と扉の種類を確認してください', a: 'ドアロックの表面に書かれたメーカー名と型番、扉の材質（鉄製・木製など）と厚みをお知らせいただければ、必要な部品や作業方法を事前に準備できます。' },
  },
  {
    kind: 'guide',
    ko: { q: '정확한 주소와 출입 방법을 준비해 주세요', a: '상세 주소와 공동현관·주차 출입 방법, 현장에서 연락 가능한 번호를 준비해 주세요. 방문이 더 빨라져요.' },
    en: { q: 'Have your exact address and access details ready', a: 'Please have the full address, how to get through the building entrance or parking, and a number we can reach you at on site. It makes the visit faster.' },
    zh: { q: '请准备好准确的地址和进出方式', a: '请准备好详细地址、公共大门或停车场的进入方式，以及现场可联系的电话号码，这样上门会更快。' },
    ja: { q: '正確な住所と出入りの方法をご準備ください', a: '詳しい住所、共同玄関や駐車場の出入り方法、現地で連絡がつく電話番号をご準備ください。訪問がより早くなります。' },
  },
  {
    kind: 'guide',
    ko: { q: '본인 확인이 필요할 수 있어요', a: '잠긴 문을 열 때는 해당 장소에 거주하거나 사용하는 분인지 확인을 요청드릴 수 있어요. 안전한 작업을 위해 협조해 주세요.' },
    en: { q: 'We may need to confirm who you are', a: 'When opening a locked door, we may ask you to confirm that you live at or use the place. Thank you for helping us keep everyone safe.' },
    zh: { q: '可能需要确认您的身份', a: '开启被锁的门时，我们可能会请您确认您是否居住在或使用该场所。为了安全作业，感谢您的配合。' },
    ja: { q: 'ご本人確認をお願いする場合があります', a: '施錠された扉を開ける際、その場所にお住まい、またはご利用の方かどうかの確認をお願いすることがあります。安全な作業のため、ご協力ください。' },
  },
  {
    kind: 'guide',
    ko: { q: '원하는 제품이 있다면 미리 골라 주세요', a: '홈페이지의 제품 메뉴에서 설치를 원하는 제품을 미리 정해 두시면 상담이 빨라져요.' },
    en: { q: 'Pick a product in advance if you have one in mind', a: 'Browse the Products page and decide which one you want installed. It makes the consultation faster.' },
    zh: { q: '如果有想要的产品，请提前选好', a: '请在网站的产品页面提前选好想要安装的产品，这样咨询会更快。' },
    ja: { q: 'ご希望の製品があれば、事前にお選びください', a: 'ホームページの製品ページで設置をご希望の製品を決めておくと、ご相談がスムーズです。' },
  },
  {
    kind: 'guide',
    ko: { q: '비용과 작업 시간은 작업 전에 확인하세요', a: '작업 종류와 현장 상황에 따라 달라지므로, 작업을 시작하기 전에 전화나 현장에서 안내를 받아 확인해 주세요.' },
    en: { q: 'Confirm the cost and time before the work starts', a: 'They depend on the type of work and the situation on site, so please confirm them with us by phone or on site before work begins.' },
    zh: { q: '请在作业前确认费用和时间', a: '费用和作业时间会因作业类型和现场情况而不同，请在开始作业前通过电话或现场说明进行确认。' },
    ja: { q: '料金と作業時間は作業前にご確認ください', a: '作業の種類や現場の状況によって異なりますので、作業を始める前にお電話または現場でご案内を受けてご確認ください。' },
  },
];
