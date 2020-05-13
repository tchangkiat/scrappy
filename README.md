# scrappy

A script to scrap web pages for header and page object information

## How To Use

1. Clone this repository

2. Run "npm install" command

3. Edit "config.json" to state the level limit and websites to scrap

   - levelLimit (integer): to restrict the level to scraping. E.g. level 0 = index/homepage only, level 1 = all links (to pages) found on the homepage, etc.

   - websites (array of string): list of websites to scrap

4. Run "npm start" to start scraping
