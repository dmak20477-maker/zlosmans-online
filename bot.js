const { Telegraf, Markup } = require('telegraf');

// Твой токен от @BotFather
const BOT_TOKEN = '8455090611:AAHv_lu6qHiqDiDFIBRw-_8L0zxgrAH8K-0';
const bot = new Telegraf(BOT_TOKEN);

// Ссылка на твой работающий онлайн-сервер на Render
const webAppUrl = 'https://zlosmans-online.onrender.com'; 

// Ссылка-перенаправление, которая сразу откроет WebApp из любого чата через личку бота
const botUsername = 'zlosmans_bot'; // Если у твоего бота другой юзернейм, замени на свой без знака @
const directPlayUrl = `https://t.me/${botUsername}?startapp=true`;

// 1. Команда /start (Приветствие)
bot.start((ctx) => {
    const chatType = ctx.chat.type;
    
    if (chatType === 'private') {
        ctx.reply(
            "💎 **ПЛОВЦЕНТР HUB | by Денис** 💎\n\n" +
            "Добро пожаловать в элитный игровой синдикат.\n\n" +
            "🎮 Жми кнопку ниже, чтобы ворваться в онлайн-замесы или запустить оффлайн-пати прямо на своем экране!",
            Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 ВОЙТИ В ПЛОВЦЕНТР', webAppUrl)],
                [Markup.button.url('➕ ДОБАВИТЬ В БЕСЕДУ', `https://t.me/${ctx.botInfo.username}?startgroup=true`)]
            ])
        );
    } else {
        ctx.reply(
            "🔥 **ПЛОВЦЕНТР В ЗДАНИИ!** 🔥\n\n" +
            "Автор: Денис | Личка: @ekx888d\n\n" +
            "Готовы раскидать партию в Дурака, устроить танковую дуэль или Алмазную Лихорадку?\n\n" +
            "👇 Открывайте хаб через безопасную кнопку ниже:",
            Markup.inlineKeyboard([
                [Markup.button.url('🎮 ИГРАТЬ С КОРЕШАМИ', directPlayUrl)]
            ])
        );
    }
});

// 2. Команда /games (Быстрый вызов меню)
bot.command('games', (ctx) => {
    const chatType = ctx.chat.type;
    const button = chatType === 'private' 
        ? Markup.button.webApp('🚀 Открыть Хаб', webAppUrl) 
        : Markup.button.url('🚀 Открыть Хаб', directPlayUrl);

    ctx.reply(
        "🎲 **МЕНЮ ИГР | ПЛОВЦЕНТР**\n\n" +
        "🌐 **Онлайн:** Пинг-Понг, Дурак, Шашки, Морской Бой, Квиз, Крестики-Нолики.\n" +
        "🍻 **Оффлайн:** Танки 2D, Умная Мафия, Алмазная Лихорадка, Шашки.\n\n" +
        "Залетай по кнопке ниже:",
        Markup.inlineKeyboard([[button]])
    );
});

// 3. Команда /help (Помощь и правила)
bot.command('help', (ctx) => {
    ctx.reply(
        "ℹ️ **СПРАВКА ПЛОВЦЕНТРА**\n\n" +
        "• **ОНЛАЙН:** Выбирай открытую комнату в лобби и залетай в один клик! Или введи свой секретный код и жди друга.\n" +
        "• **ОФФЛАЙН:** Игры для тусовки на одном телефоне. Запускай Танки, Мафию или Лихорадку и передавай мобилу по кругу.\n\n" +
        "Создатель: Денис\n" +
        "Связь / Личка: @ekx888d"
    );
});

// Запуск бота
bot.launch().then(() => {
    console.log('=========================================');
    console.log('🚀 Бот ПЛОВЦЕНТР HUB успешно запущен!');
    console.log('💎 Автор: Денис | Личка: @ekx888d');
    console.log('=========================================');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
