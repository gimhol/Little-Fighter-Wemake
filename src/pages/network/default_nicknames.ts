import { NICKNAME_MAX_LENGTH } from "../../Net";

const EN_ADJECTIVES: readonly string[] = [
  "Swift", "Shadow", "Iron", "Frost", "Blaze", "Silent", "Golden", "Crimson",
  "Storm", "Night", "Thunder", "Ghost", "Steel", "Wild", "Lucky", "Mystic",
  "Sacred", "Savage", "Fierce", "Brave", "Dark", "Wind", "Flame", "Turbo",
  "Mega", "Ultra", "Tiny", "Giant", "Crazy", "Sneaky", "Noble", "Royal",
  "Neon", "Pixel", "Retro", "Cute", "Sleepy", "Hungry", "Shiny", "Fuzzy",
  "Lunar", "Solar", "Misty", "Rusty", "Sassy", "Jolly", "Grumpy", "Chubby",
  "Scrappy", "Zippy", "Dizzy",
];

const EN_NOUNS: readonly string[] = [
  "Fox", "Tiger", "Wolf", "Blade", "Fist", "Paw", "Comet", "Spark",
  "Owl", "Panda", "Dragon", "Cat", "Dog", "Bear", "Lion", "Eagle",
  "Falcon", "Cobra", "Viper", "Shark", "Whale", "Otter", "Badger", "Rabbit",
  "Turtle", "Monkey", "Penguin", "Hamster", "Squirrel", "Noodle", "Dumpling", "Tofu",
  "Cookie", "Muffin", "Ramen", "Taco", "Pizza", "Burger", "Donut", "Waffle",
  "Pickle", "Potato", "Tomato", "Banana", "Mango", "Melon", "Lemon", "Kiwi",
  "Cocoa", "Latte", "Coffee", "Boba", "Sushi", "Wonton", "Mochi", "Nugget",
  "Pretzel", "Popcorn", "Bun", "Pie",
];

const ZH_ADJECTIVES: readonly string[] = [
  "疾风", "无敌", "大力", "孤独", "神秘", "沉默", "疯狂", "冷酷",
  "温柔", "暴躁", "憨厚", "帅气", "霸气", "低调", "高冷", "傲娇",
  "呆萌", "闪电", "烈火", "寒冰", "幻影", "铁血", "天下", "绝世",
  "超级", "暗黑", "快乐", "摸鱼", "暴富", "旋风", "雷霆", "幽冥",
  "梦幻", "星辰", "逍遥", "自在", "闪闪", "麻辣", "冰镇", "香脆",
  "佛系", "中二",
];

const ZH_NOUNS: readonly string[] = [
  "拳王", "豆腐", "忍者", "冰佬", "奶妈", "弓手", "铁甲", "火人",
  "腿王", "木头", "大侠", "剑客", "刀客", "浪人", "小霸王", "铁头娃",
  "菜鸟", "老六", "光头", "火锅", "辣条", "包子", "馒头", "汤圆",
  "麻花", "老王", "小李", "阿强", "阿珍", "路人甲", "路人乙", "酱油党",
  "吃瓜群众", "沙发", "板凳", "马扎", "板砖", "拖鞋", "咸鱼", "鲤鱼",
  "鲨鱼", "章鱼", "鱿鱼", "熊猫", "老虎", "狮子", "猴子", "兔子",
  "狗子", "喵喵", "汪汪", "咕咕", "憨憨", "呆呆", "大师", "宗师",
  "掌门", "帮主", "盟主", "教主", "队长", "班长", "少侠", "女侠",
  "镖师", "捕快", "侠客", "隐士", "高人", "扫地僧", "混子", "小虎",
  "小龙", "小马", "小牛", "小狼", "小狐", "小鹿", "小熊", "小猫",
  "小狗", "西瓜", "菠萝", "草莓", "葡萄", "苹果", "香蕉", "芒果",
  "荔枝", "奶茶", "咖啡", "豆浆", "油条", "煎饼", "炒饭", "拉面",
  "米线", "饺子", "串串", "烧烤",
];

export function pick_default_nickname(...langs: (string | null | undefined)[]): string {
  const zh = langs.some((v) => /^zh/i.test(`${v ?? ""}`));
  const adjectives = zh ? ZH_ADJECTIVES : EN_ADJECTIVES;
  const nouns = zh ? ZH_NOUNS : EN_NOUNS;
  for (let i = 0; i < 16; i++) {
    const name = adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)];
    if ([...name].length <= NICKNAME_MAX_LENGTH) return name;
  }
  return nouns[Math.floor(Math.random() * nouns.length)];
}
