import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd

# ログ設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    # Chromeオプションの設定
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")  # 新しいヘッドレスモード
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")

    # ドライバーの初期化 (Selenium Managerが自動でドライバを管理しますが、明示的にServiceを使う場合)
    # Selenium 4.6以降は webdriver_manager なしでも動きますが、指定があったため使用します。
    service = Service(ChromeDriverManager().install())
    
    try:
        driver = webdriver.Chrome(service=service, options=chrome_options)
        logging.info("ブラウザを起動しました")

        # ターゲットURLにアクセス
        url = "https://www.python.org/"
        driver.get(url)
        logging.info(f"{url} にアクセスしました")

        # サイトタイトルの取得
        site_title = driver.title
        print(f"=== サイトタイトル ===\n{site_title}\n")

        # 最新ニュースの取得 (.blog-widget li から取得)
        # Python.orgの構造に合わせてセレクタを指定
        news_elements = driver.find_elements(By.CSS_SELECTOR, ".blog-widget li")
        
        news_data = []
        print("=== 最新ニュース (Top 5) ===")
        for i, elem in enumerate(news_elements[:5], 1):
            try:
                # 日付
                date_elem = elem.find_element(By.TAG_NAME, "time")
                date_text = date_elem.text
                
                # タイトルとリンク
                link_elem = elem.find_element(By.TAG_NAME, "a")
                title_text = link_elem.text
                href = link_elem.get_attribute("href")

                print(f"{i}. [{date_text}] {title_text}")
                news_data.append({"date": date_text, "title": title_text, "url": href})
            except Exception as e:
                logging.warning(f"要素の取得に失敗しました: {e}")

        # Pandasで整形して表示（デモ用）
        if news_data:
            df = pd.DataFrame(news_data)
            print("\n=== データフレーム表示 ===")
            print(df)

    except Exception as e:
        logging.error(f"エラーが発生しました: {e}")
    finally:
        if 'driver' in locals():
            driver.quit()
            logging.info("ブラウザを終了しました")

if __name__ == "__main__":
    main()
