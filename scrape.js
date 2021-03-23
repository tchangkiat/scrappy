const puppeteer = require("puppeteer");
const $ = require("cheerio");
const common = require("./common");

async function scrape(website, levelLimit, budget) {
  const websiteq = new URL(website);

  async function scrapePage(pagePath = "/", level = 0) {
    const pageUrl = websiteq.origin + pagePath;
    if (pagePath == "") return;
    if (budget !== 0 && scrapeCount >= budget) return;
    scrapeCount++;

    common.log("Scraping " + pageUrl);
    const page = await browser.newPage();
    var objectsRequested = [];
    const scrapePageStartTime = Date.now();

    try {
      var requestStartTime = {};
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        requestStartTime[request.url()] = Date.now();
        request.continue();
      });

      await page.on("response", async (response) => {
        const url = response.url();
        const headers = response.headers();

        try {
          const buffer = await response.buffer();
          objectsRequested.push({
            url: url.startsWith("data:image/")
              ? "(Base64 Value of an Image)"
              : new URL(url).pathname,
            type: headers["content-type"],
            status: response.status(),
            csp: headers["content-security-policy"],
            cacheControl: headers["cache-control"]
              ? headers["cache-control"].replace(/"/g, "'")
              : "undefined",
            xCache: headers["x-cache"],
            localCache: response.fromCache(),
            size: buffer.length,
            loadTime: Date.now() - requestStartTime[url],
            remarks: "",
          });
        } catch (err) {
          objectsRequested.push({
            url: url.startsWith("data:image/")
              ? "(Base64 Value of an Image)"
              : new URL(url).pathname,
            type: headers["content-type"],
            status: response.status(),
            csp: headers["content-security-policy"],
            cacheControl: headers["cache-control"]
              ? headers["cache-control"].replace(/"/g, "'")
              : "undefined",
            xCache: headers["x-cache"],
            localCache: response.fromCache(),
            size: "",
            loadTime: Date.now() - requestStartTime[url],
            remarks: "Object Error: " + err.message,
          });
        }
      });

      const pageLoadStart = Date.now();
      await page.goto(pageUrl, {
        timeout: 8000,
      });
      const content = await page.content();
      const jquery_version = await page.evaluate(() => {
        try {
          return jQuery.fn.jquery;
        } catch (err) {
          return err.message;
        }
      });
      const pageLoadTime = Date.now() - pageLoadStart;

      const title = $("title", content).text();
      const description = $("meta[name='description']", content).attr(
        "content"
      );

      scrapeResult.pages.push({
        title: title,
        description: description,
        url: pageUrl,
        objects: objectsRequested,
        loadTime: pageLoadTime,
        level: level,
        jquery: jquery_version,
        remarks: "",
      });

      if (levelLimit === -1 || level < levelLimit) {
        var links = [];
        $("a", content).each(function (index, value) {
          const link = trimLink($(value).attr("href"), website);
          if (
            !(
              pageMemo.includes(link) ||
              link == "#" ||
              links.includes(link) ||
              isExternalUrl(link, websiteq) ||
              includeListedExtension(link)
            )
          ) {
            links.push(link);
            pageMemo.push(link);
          }
        });

        for (var link of links) {
          await scrapePage(link, level + 1);
          await common.wait(250);
        }
      }
    } catch (err) {
      scrapeResult.pages.push({
        title: "",
        description: "",
        url: websiteq.origin + pagePath,
        objects: objectsRequested,
        loadTime: Date.now() - scrapePageStartTime,
        level: level,
        remarks: "Page Error: " + err.message,
      });
    } finally {
      await page.close();
    }
  }

  const browser = await puppeteer.launch();
  var scrapeResult = {
    website: "",
    generatedOn: "",
    totalPages: 0,
    pages: [],
  };
  var pageMemo = ["/"];
  var scrapeCount = 0;
  website = trimLink(website, true);

  await scrapePage();
  scrapeResult.website = website;
  scrapeResult.generatedOn =
    common.getCurrentDate() + ", " + common.getCurrentTime();
  scrapeResult.totalPages = scrapeResult.pages.length;
  scrapeResult.pages = scrapeResult.pages.sort(function (a, b) {
    return a.level - b.level;
  });

  await browser.close();

  return scrapeResult;
}

function trimLink(link, website, origin = false) {
  if (link == "" || link == undefined) return link;

  link = link.split("#")[0];
  if (!origin) link = link.replace(website, "");

  while (link.endsWith("/")) {
    link = link.substring(0, link.length - 1);
  }

  if (link.startsWith("http")) return link;

  if (!link.startsWith("/")) {
    link = "/" + link;
  }
  return link;
}

function isExternalUrl(url, websiteq) {
  if (url == "" || url == undefined) return true;

  try {
    var match = url.match(
      /^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/
    );
    if (
      typeof match[1] === "string" &&
      match[1].length > 0 &&
      match[1].toLowerCase() !== websiteq.protocol
    )
      return true;
    if (
      typeof match[2] === "string" &&
      match[2].length > 0 &&
      match[2].replace(
        new RegExp(
          ":(" + { "http:": 80, "https:": 443 }[websiteq.protocol] + ")?$"
        ),
        ""
      ) !== websiteq.host
    )
      return true;
    return false;
  } catch (err) {
    common.log(err.message, 4);
    return true;
  }
}

function includeListedExtension(url) {
  var splitUrl = url.split("#");
  splitUrl = splitUrl[0].split("?");
  return (
    splitUrl[0].endsWith(".jpg") ||
    splitUrl[0].endsWith(".jpeg") ||
    splitUrl[0].endsWith(".png") ||
    splitUrl[0].endsWith(".gif") ||
    splitUrl[0].endsWith(".mp4") ||
    splitUrl[0].endsWith(".mov") ||
    splitUrl[0].endsWith(".pdf") ||
    splitUrl[0].endsWith(".zip")
  );
}

module.exports = {
  scrape,
};
