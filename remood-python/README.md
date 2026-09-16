# ReMood — Python Edition

نسخة مستقلة من تطبيق ReMood مكتوبة بالكامل بلغة Python باستخدام Streamlit.

## المزايا

- توصيات كتب حسب المدينة والطقس والمزاج والفئة وطول الكتاب.
- دعم العربية والإنجليزية والفرنسية.
- لغة الواجهة مستقلة عن لغة الكتب.
- لغة الكتاب المختارة تتحكم في كل محتوى النتائج: الكتب، المؤلفون، الأسباب، الاقتباسات، التحليل، والعناوين داخل بطاقات النتائج.
- مدن متعددة مع الوقت المحلي والمنطقة الزمنية.
- طقس مباشر من Open-Meteo بدون مفتاح API.
- استبعاد الكتب المقروءة مسبقاً.
- روابط Goodreads وLibby وGutenberg وStorytel وAudible وKindle وGoogle Play وKobo.
- روابط Showcase مثل:
  - `?showcase=spring-paris`
  - `?showcase=summer-riyadh`
  - `?showcase=autumn-london`
  - `?showcase=winter-moscow`
  - `?showcase=storm-doha`

## التشغيل محلياً

```bash
cd remood-python
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
streamlit run app.py --server.port 5000
```

ثم افتح الرابط الذي يظهر في الطرفية.

## هيكل المشروع

- `app.py` — واجهة Streamlit.
- `remood.py` — جلب الطقس، الوقت المحلي، التوصية، التقييم، والتحليل.
- `data.py` — المدن والترجمات والكتب والاقتباسات.
- `requirements.txt` — الاعتمادات المطلوبة.

لا تحتاج النسخة إلى Node.js أو React أو مفتاح OpenAI لتعمل.