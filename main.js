const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
    const page = await browser.newPage();

    // 保存 Cookies 和本地存储
    async function saveSession() {
        try {
            const cookies = await page.cookies();
            fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));

            const localStorageData = await page.evaluate(() => JSON.stringify(localStorage));
            fs.writeFileSync('localStorage.json', localStorageData);

            console.log('会话数据已保存');
        } catch (error) {
            console.error('保存会话数据时出错:', error);
        }
    }

    // 加载 Cookies 和本地存储
    async function loadSession() {
        try {
            const cookies = JSON.parse(fs.readFileSync('cookies.json'));
            await page.setCookie(...cookies);

            const localStorageData = fs.readFileSync('localStorage.json', 'utf8');
            await page.evaluate(data => {
                const entries = JSON.parse(data);
                for (const [key, value] of Object.entries(entries)) {
                    localStorage.setItem(key, value);
                }
            }, localStorageData);

            console.log('会话数据已加载');
        } catch (error) {
            console.error('加载会话数据时出错:', error);
        }
    }

    // 检查是否存在会话数据文件，并根据情况加载或保存会话数据
    if (fs.existsSync('cookies.json') && fs.existsSync('localStorage.json')) {
        await page.goto('https://creator.douyin.com/creator-micro/home', { waitUntil: 'networkidle2' });
        await loadSession();
        await page.reload({ waitUntil: 'networkidle2' });
    } else {
        // 导航到登录页面
        await page.goto('https://creator.douyin.com/');

        // 手动登录
        console.log('请手动登录...');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const currentUrl = page.url();
        const loggedInElement = await page.$('.f3hat');
        if (currentUrl === 'https://creator.douyin.com/creator-micro/home' && loggedInElement !== null) {
            console.log('登录成功，保存登录数据');
            await saveSession();
        }
    }

    // 导航到目标页面
    await page.goto('https://creator.douyin.com/creator-micro/home', { waitUntil: 'networkidle2' });

    // 检查是否登录成功
    const loggedInElement = await page.$('.f3hat');
    if (loggedInElement) {
        console.log('登录成功');
    } else {
        console.log('登录失败');
        await browser.close();
        return;
    }

    // 进入上传页面
    await page.goto('https://creator.douyin.com/creator-micro/content/upload', { waitUntil: 'networkidle2' });

    // 等待页面加载完成并找到文件输入框
    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector);

    // 模拟文件上传
    const filePath = path.relative(process.cwd(), './video.mp4');
    const input = await page.$(fileInputSelector);
    await input.uploadFile(filePath);

    let newPageURL;
    page.on('framenavigated', async (frame) => {
        if (frame === page.mainFrame()) {
            newPageURL = frame.url();
            console.log('页面跳转到:', newPageURL);
        }
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('跳转后的页面 URL:', newPageURL);

    // 等待并填写视频标题
    await page.waitForSelector('.semi-input', { visible: true });
    await page.evaluate((selector, value) => {
        document.querySelector(selector).value = value;
    }, '.semi-input', '测试视频');

    console.log('内容已写入 input 元素');

    // 定义一个函数来检查元素的内容是否符合预期
    async function waitForSpecificText(selector, expectedText) {
        try {
            await page.waitForFunction(
                (selector, expectedText) => {
                    const element = document.querySelector(selector);
                    return element && element.innerText.includes(expectedText);
                },
                {},
                selector,
                expectedText
            );
            console.log(`检测到预期文本: ${expectedText}`);
        } catch (error) {
            console.error(`等待预期文本 "${expectedText}" 时出错:`, error);
        }
    }

    // 等待上传成功提示
    await waitForSpecificText('.semi-toast-content-text', '上传成功');

    // 点击发布按钮
    const publishButtonSelector = '.content-confirm-container--anYOC .button--1SZwR';
    await page.waitForSelector(publishButtonSelector, { visible: true });
    await page.click(publishButtonSelector);

    // 等待发布成功提示
    await waitForSpecificText('.semi-toast-content-text', '发布成功');

    await browser.close();
})();
