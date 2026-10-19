"""
generate_field_catalog.py
--------------------------
Generates data/catalog/fields.json — the master catalog of every field
used by the eligibility engine, with English + Hindi labels, type info,
valid options, and which schemes use each field.

Run:  python scripts/generate_field_catalog.py
"""
import json
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "catalog" / "fields.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

# fmt: off
FIELDS = [

  # ─── HIGH-PRIORITY (used by many schemes) ──────────────────────────────────

  {
    "id": "age",
    "type": "integer",
    "min": 0, "max": 120,
    "label_en": "What is your age (in years)?",
    "label_hi": "आपकी आयु कितनी है (वर्षों में)?",
    "hint_en": "Enter your current age as a whole number.",
    "hint_hi": "अपनी वर्तमान आयु पूर्ण संख्या में दर्ज करें।",
    "used_by_count": 12,
    "used_by": ["ab-pmjay", "apy", "igndps", "ignwps", "mmlby",
                "nsap-ignoaps", "pm-sym", "pmjdy", "pmjjby", "pmkmdy",
                "pmuy", "sbssps"]
  },
  {
    "id": "household.bpl",
    "type": "boolean",
    "label_en": "Is your household listed on a BPL (Below Poverty Line) card?",
    "label_hi": "क्या आपका परिवार BPL (गरीबी रेखा से नीचे) राशन कार्ड पर सूचीबद्ध है?",
    "hint_en": "BPL cards are issued by the state government to low-income families.",
    "hint_hi": "BPL कार्ड राज्य सरकार द्वारा कम आय वाले परिवारों को जारी किए जाते हैं।",
    "used_by_count": 6,
    "used_by": ["ab-pmjay", "igndps", "ignwps", "nsap-ignoaps", "pmuy", "sbssps"]
  },
  {
    "id": "household.state",
    "type": "enum",
    "options": [
      { "value": "Andhra Pradesh",       "label_en": "Andhra Pradesh",       "label_hi": "आंध्र प्रदेश" },
      { "value": "Arunachal Pradesh",    "label_en": "Arunachal Pradesh",    "label_hi": "अरुणाचल प्रदेश" },
      { "value": "Assam",                "label_en": "Assam",                "label_hi": "असम" },
      { "value": "Bihar",                "label_en": "Bihar",                "label_hi": "बिहार" },
      { "value": "Chhattisgarh",         "label_en": "Chhattisgarh",         "label_hi": "छत्तीसगढ़" },
      { "value": "Goa",                  "label_en": "Goa",                  "label_hi": "गोवा" },
      { "value": "Gujarat",              "label_en": "Gujarat",              "label_hi": "गुजरात" },
      { "value": "Haryana",              "label_en": "Haryana",              "label_hi": "हरियाणा" },
      { "value": "Himachal Pradesh",     "label_en": "Himachal Pradesh",     "label_hi": "हिमाचल प्रदेश" },
      { "value": "Jharkhand",            "label_en": "Jharkhand",            "label_hi": "झारखंड" },
      { "value": "Karnataka",            "label_en": "Karnataka",            "label_hi": "कर्नाटक" },
      { "value": "Kerala",               "label_en": "Kerala",               "label_hi": "केरल" },
      { "value": "Madhya Pradesh",       "label_en": "Madhya Pradesh",       "label_hi": "मध्य प्रदेश" },
      { "value": "Maharashtra",          "label_en": "Maharashtra",          "label_hi": "महाराष्ट्र" },
      { "value": "Manipur",              "label_en": "Manipur",              "label_hi": "मणिपुर" },
      { "value": "Meghalaya",            "label_en": "Meghalaya",            "label_hi": "मेघालय" },
      { "value": "Mizoram",              "label_en": "Mizoram",              "label_hi": "मिज़ोरम" },
      { "value": "Nagaland",             "label_en": "Nagaland",             "label_hi": "नागालैंड" },
      { "value": "Odisha",               "label_en": "Odisha",               "label_hi": "ओडिशा" },
      { "value": "Punjab",               "label_en": "Punjab",               "label_hi": "पंजाब" },
      { "value": "Rajasthan",            "label_en": "Rajasthan",            "label_hi": "राजस्थान" },
      { "value": "Sikkim",               "label_en": "Sikkim",               "label_hi": "सिक्किम" },
      { "value": "Tamil Nadu",           "label_en": "Tamil Nadu",           "label_hi": "तमिलनाडु" },
      { "value": "Telangana",            "label_en": "Telangana",            "label_hi": "तेलंगाना" },
      { "value": "Tripura",              "label_en": "Tripura",              "label_hi": "त्रिपुरा" },
      { "value": "Uttar Pradesh",        "label_en": "Uttar Pradesh",        "label_hi": "उत्तर प्रदेश" },
      { "value": "Uttarakhand",          "label_en": "Uttarakhand",          "label_hi": "उत्तराखंड" },
      { "value": "West Bengal",          "label_en": "West Bengal",          "label_hi": "पश्चिम बंगाल" },
      { "value": "Delhi",                "label_en": "Delhi",                "label_hi": "दिल्ली" },
      { "value": "Jammu & Kashmir",      "label_en": "Jammu & Kashmir",      "label_hi": "जम्मू और कश्मीर" },
      { "value": "Ladakh",               "label_en": "Ladakh",               "label_hi": "लद्दाख" },
      { "value": "Other",                "label_en": "Other / Union Territory","label_hi": "अन्य / केंद्र शासित प्रदेश" }
    ],
    "label_en": "Which state does your household belong to?",
    "label_hi": "आपका परिवार किस राज्य में रहता है?",
    "hint_en": "Select the state where you currently live.",
    "hint_hi": "वह राज्य चुनें जहाँ आप वर्तमान में रहते हैं।",
    "used_by_count": 5,
    "used_by": ["mjpjay", "mmlby", "namo-shetkari-mahasanman-nidhi-yojana", "sbssps", "sgngs"]
  },
  {
    "id": "gender",
    "type": "enum",
    "options": [
      { "value": "male",        "label_en": "Male",        "label_hi": "पुरुष" },
      { "value": "female",      "label_en": "Female",      "label_hi": "महिला" },
      { "value": "transgender", "label_en": "Transgender", "label_hi": "ट्रांसजेंडर" }
    ],
    "label_en": "What is your gender?",
    "label_hi": "आपका लिंग क्या है?",
    "hint_en": "",
    "hint_hi": "",
    "used_by_count": 4,
    "used_by": ["ignwps", "mmlby", "pmuy", "sgngs"]
  },
  {
    "id": "has_bank_account",
    "type": "boolean",
    "label_en": "Do you have a savings bank account (or post office savings account)?",
    "label_hi": "क्या आपके पास बचत बैंक खाता (या डाकघर बचत खाता) है?",
    "hint_en": "Any scheduled commercial bank or post office account qualifies.",
    "hint_hi": "कोई भी अनुसूचित वाणिज्यिक बैंक या डाकघर खाता योग्य है।",
    "used_by_count": 4,
    "used_by": ["apy", "pm-sym", "pmjjby", "pmkmdy"]
  },
  {
    "id": "household.income",
    "type": "integer",
    "min": 0,
    "label_en": "What is your household's total annual income (in rupees)?",
    "label_hi": "आपके परिवार की कुल वार्षिक आय (रुपयों में) क्या है?",
    "hint_en": "Include income from all earning members of the household.",
    "hint_hi": "परिवार के सभी कमाने वाले सदस्यों की आय शामिल करें।",
    "used_by_count": 4,
    "used_by": ["mmlby", "pmay-u", "sbssps", "sgngs"]
  },
  {
    "id": "household.area_type",
    "type": "enum",
    "options": [
      { "value": "rural", "label_en": "Rural (village / gram panchayat area)", "label_hi": "ग्रामीण (गाँव / ग्राम पंचायत क्षेत्र)" },
      { "value": "urban", "label_en": "Urban (town / city / municipal area)",  "label_hi": "शहरी (कस्बा / शहर / नगर पालिका क्षेत्र)" }
    ],
    "label_en": "Does your household live in a rural or urban area?",
    "label_hi": "आपका परिवार ग्रामीण या शहरी क्षेत्र में रहता है?",
    "hint_en": "Rural = village listed under gram panchayat. Urban = within a municipality or town boundary.",
    "hint_hi": "ग्रामीण = ग्राम पंचायत के अंतर्गत गाँव। शहरी = नगर पालिका या शहर की सीमा के भीतर।",
    "used_by_count": 3,
    "used_by": ["ab-pmjay", "pmay-g", "pmay-u"]
  },
  {
    "id": "marital_status",
    "type": "enum",
    "options": [
      { "value": "married",   "label_en": "Married",   "label_hi": "विवाहित" },
      { "value": "unmarried", "label_en": "Unmarried", "label_hi": "अविवाहित" },
      { "value": "widowed",   "label_en": "Widowed",   "label_hi": "विधवा/विधुर" },
      { "value": "divorced",  "label_en": "Divorced",  "label_hi": "तलाकशुदा" },
      { "value": "abandoned", "label_en": "Abandoned / Separated", "label_hi": "परित्यक्त / अलग" }
    ],
    "label_en": "What is your marital status?",
    "label_hi": "आपकी वैवाहिक स्थिति क्या है?",
    "hint_en": "",
    "hint_hi": "",
    "used_by_count": 3,
    "used_by": ["ignwps", "mmlby", "sgngs"]
  },

  # ─── MODERATE PRIORITY (used by 2 schemes) ─────────────────────────────────

  {
    "id": "has_disability",
    "type": "boolean",
    "label_en": "Do you have any disability recognised under the RPwD Act 2016?",
    "label_hi": "क्या आपके पास RPwD अधिनियम 2016 के तहत मान्यता प्राप्त कोई दिव्यांगता है?",
    "hint_en": "Includes physical, intellectual, mental, or multiple disabilities with a valid disability certificate.",
    "hint_hi": "वैध दिव्यांगता प्रमाणपत्र के साथ शारीरिक, बौद्धिक, मानसिक या बहु-दिव्यांगता शामिल है।",
    "used_by_count": 2,
    "used_by": ["igndps", "sgngs"]
  },
  {
    "id": "household.house_type",
    "type": "enum",
    "options": [
      { "value": "none",       "label_en": "No house / homeless",           "label_hi": "कोई घर नहीं / बेघर" },
      { "value": "kutcha",     "label_en": "Kutcha (mud/thatch/bamboo)",    "label_hi": "कच्चा (मिट्टी/फूस/बाँस)" },
      { "value": "semi_pucca", "label_en": "Semi-pucca (mixed materials)",  "label_hi": "अर्ध-पक्का (मिश्रित सामग्री)" },
      { "value": "pucca",      "label_en": "Pucca (brick/concrete/stone)",  "label_hi": "पक्का (ईंट/कंक्रीट/पत्थर)" }
    ],
    "label_en": "What type of house does your household live in?",
    "label_hi": "आपका परिवार किस प्रकार के घर में रहता है?",
    "hint_en": "Kutcha = walls or roof made of mud, thatch, bamboo, or other temporary materials.",
    "hint_hi": "कच्चा = मिट्टी, फूस, बाँस या अन्य अस्थायी सामग्री से बनी दीवारें या छत।",
    "used_by_count": 2,
    "used_by": ["ab-pmjay", "pmay-g"]
  },
  {
    "id": "household.is_sc_st",
    "type": "boolean",
    "label_en": "Does your household belong to a Scheduled Caste (SC) or Scheduled Tribe (ST)?",
    "label_hi": "क्या आपका परिवार अनुसूचित जाति (SC) या अनुसूचित जनजाति (ST) से है?",
    "hint_en": "As listed in the Constitution of India for your state.",
    "hint_hi": "आपके राज्य के लिए भारत के संविधान में सूचीबद्ध।",
    "used_by_count": 2,
    "used_by": ["ab-pmjay", "pmuy"]
  },
  {
    "id": "household.owns_cultivable_land",
    "type": "boolean",
    "label_en": "Does your household own cultivable agricultural land (in any member's name)?",
    "label_hi": "क्या आपके परिवार के पास (किसी सदस्य के नाम पर) कृषि योग्य भूमि है?",
    "hint_en": "Land should be recorded in official land records (7/12 or equivalent).",
    "hint_hi": "भूमि आधिकारिक भूमि अभिलेखों (7/12 या समकक्ष) में दर्ज होनी चाहिए।",
    "used_by_count": 2,
    "used_by": ["namo-shetkari-mahasanman-nidhi-yojana", "pm-kisan"]
  },
  {
    "id": "household.owns_pucca_house",
    "type": "boolean",
    "label_en": "Does your household own a pucca house?",
    "label_hi": "क्या आपके परिवार के पास कोई पक्का मकान है?",
    "hint_en": "A pucca house has walls and roof made of permanent materials (brick, cement, stone).",
    "hint_hi": "पक्के मकान की दीवारें और छत स्थायी सामग्री (ईंट, सीमेंट, पत्थर) से बनी होती हैं।",
    "used_by_count": 2,
    "used_by": ["pmay-g", "pmay-u"]
  },
  {
    "id": "household.rooms",
    "type": "integer",
    "min": 0,
    "label_en": "How many rooms does your house have (excluding kitchen and bathroom)?",
    "label_hi": "आपके घर में कितने कमरे हैं (रसोई और बाथरूम को छोड़कर)?",
    "hint_en": "Count only habitable rooms used for sleeping or living.",
    "hint_hi": "केवल सोने या रहने के लिए उपयोग किए जाने वाले कमरे गिनें।",
    "used_by_count": 2,
    "used_by": ["ab-pmjay", "pmay-g"]
  },
  {
    "id": "household.special_vulnerable_group",
    "type": "boolean",
    "label_en": "Is any member of your household in a special vulnerable category?",
    "label_hi": "क्या आपके परिवार का कोई सदस्य किसी विशेष संवेदनशील श्रेणी में है?",
    "hint_en": "Includes: bonded labourers, manual scavengers, primitive tribal groups, or legally released bonded labourers.",
    "hint_hi": "इसमें शामिल हैं: बंधुआ मजदूर, मैनुअल मेहतर, आदिम जनजातीय समूह, या कानूनी रूप से मुक्त बंधुआ मजदूर।",
    "used_by_count": 2,
    "used_by": ["ab-pmjay", "pmay-g"]
  },
  {
    "id": "is_destitute",
    "type": "boolean",
    "label_en": "Are you destitute (without regular income or family support)?",
    "label_hi": "क्या आप निराश्रित हैं (नियमित आय या परिवार के समर्थन के बिना)?",
    "hint_en": "A person is considered destitute if they have no reliable source of income or family to depend on.",
    "hint_hi": "एक व्यक्ति को निराश्रित माना जाता है यदि उनके पास आय का कोई विश्वसनीय स्रोत या निर्भर करने के लिए परिवार नहीं है।",
    "used_by_count": 2,
    "used_by": ["sbssps", "sgngs"]
  },

  # ─── SINGLE-USE FIELDS ──────────────────────────────────────────────────────

  {
    "id": "disability_percent",
    "type": "integer",
    "min": 0, "max": 100,
    "label_en": "What is the percentage of your disability (as per your disability certificate)?",
    "label_hi": "आपकी दिव्यांगता का प्रतिशत क्या है (आपके दिव्यांगता प्रमाणपत्र के अनुसार)?",
    "hint_en": "Enter the percentage as stated on your government-issued disability certificate.",
    "hint_hi": "सरकार द्वारा जारी दिव्यांगता प्रमाणपत्र पर दर्शाया गया प्रतिशत दर्ज करें।",
    "used_by_count": 1,
    "used_by": ["igndps"]
  },
  {
    "id": "domicile_years_maharashtra",
    "type": "integer",
    "min": 0,
    "label_en": "For how many years have you been living in Maharashtra?",
    "label_hi": "आप कितने वर्षों से महाराष्ट्र में रह रहे हैं?",
    "hint_en": "Enter total years of continuous or accumulated residence in Maharashtra.",
    "hint_hi": "महाराष्ट्र में निरंतर या संचित निवास के कुल वर्ष दर्ज करें।",
    "used_by_count": 1,
    "used_by": ["sbssps"]
  },
  {
    "id": "has_aadhaar",
    "type": "boolean",
    "label_en": "Do you have an Aadhaar card?",
    "label_hi": "क्या आपके पास आधार कार्ड है?",
    "hint_en": "A 12-digit Unique Identification Number issued by UIDAI.",
    "hint_hi": "UIDAI द्वारा जारी 12-अंकीय विशिष्ट पहचान संख्या।",
    "used_by_count": 1,
    "used_by": ["pmkmdy"]
  },
  {
    "id": "has_aadhaar_linked_bank_account",
    "type": "boolean",
    "label_en": "Is your Aadhaar linked to your bank account?",
    "label_hi": "क्या आपका आधार आपके बैंक खाते से जुड़ा हुआ है?",
    "hint_en": "Your bank account must be seeded with your Aadhaar number for DBT.",
    "hint_hi": "DBT के लिए आपके बैंक खाते में आपका आधार नंबर जुड़ा होना चाहिए।",
    "used_by_count": 1,
    "used_by": ["mmlby"]
  },
  {
    "id": "has_mobile",
    "type": "boolean",
    "label_en": "Do you have a mobile phone?",
    "label_hi": "क्या आपके पास मोबाइल फोन है?",
    "hint_en": "Required for PM-SYM enrollment at Common Service Centres.",
    "hint_hi": "कॉमन सर्विस सेंटर पर PM-SYM नामांकन के लिए आवश्यक।",
    "used_by_count": 1,
    "used_by": ["pm-sym"]
  },
  {
    "id": "has_serious_disease",
    "type": "boolean",
    "label_en": "Do you suffer from a serious / life-threatening disease?",
    "label_hi": "क्या आप किसी गंभीर / जानलेवा बीमारी से पीड़ित हैं?",
    "hint_en": "e.g., cancer, kidney failure, thalassaemia, haemophilia. A medical certificate will be required.",
    "hint_hi": "जैसे कैंसर, किडनी फेलियर, थैलेसीमिया, हीमोफीलिया। चिकित्सा प्रमाण पत्र आवश्यक होगा।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "has_sickle_cell",
    "type": "boolean",
    "label_en": "Do you have sickle cell disease?",
    "label_hi": "क्या आपको सिकल सेल रोग है?",
    "hint_en": "A hereditary blood disorder. A medical certificate is required.",
    "hint_hi": "एक वंशानुगत रक्त विकार। चिकित्सा प्रमाण पत्र आवश्यक है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "household.disabled_member_no_able_adult",
    "type": "boolean",
    "label_en": "Does your household have a disabled member with no able-bodied adult to support them?",
    "label_hi": "क्या आपके परिवार में कोई दिव्यांग सदस्य है जिसकी देखभाल के लिए कोई सक्षम वयस्क नहीं है?",
    "hint_en": "Applies when the only adults in the household have a severe disability.",
    "hint_hi": "लागू होता है जब परिवार के केवल वयस्कों में गंभीर दिव्यांगता हो।",
    "used_by_count": 1,
    "used_by": ["ab-pmjay"]
  },
  {
    "id": "household.has_aay_card",
    "type": "boolean",
    "label_en": "Does your household have an Antyodaya Anna Yojana (AAY) ration card?",
    "label_hi": "क्या आपके परिवार के पास अंत्योदय अन्न योजना (AAY) राशन कार्ड है?",
    "hint_en": "AAY (yellow) cards are issued to the poorest of the poor families.",
    "hint_hi": "AAY (पीला) कार्ड सबसे गरीब परिवारों को जारी किए जाते हैं।",
    "used_by_count": 1,
    "used_by": ["pmuy"]
  },
  {
    "id": "household.has_domicile_certificate",
    "type": "boolean",
    "label_en": "Does your household have a Maharashtra domicile certificate?",
    "label_hi": "क्या आपके परिवार के पास महाराष्ट्र का अधिवास प्रमाणपत्र है?",
    "hint_en": "Issued by tehsildar/SDO as proof of long-term residence in Maharashtra.",
    "hint_hi": "तहसीलदार/SDO द्वारा महाराष्ट्र में दीर्घकालिक निवास के प्रमाण के रूप में जारी किया गया।",
    "used_by_count": 1,
    "used_by": ["mjpjay"]
  },
  {
    "id": "household.has_listed_urban_worker",
    "type": "boolean",
    "label_en": "Does your household have a member working in one of the listed urban occupations?",
    "label_hi": "क्या आपके परिवार में कोई सदस्य सूचीबद्ध शहरी व्यवसायों में से किसी एक में काम करता है?",
    "hint_en": "Listed occupations include: rag pickers, domestic workers, street vendors, construction workers, washermen, rickshaw pullers, cobblers, etc.",
    "hint_hi": "सूचीबद्ध व्यवसायों में शामिल हैं: कबाड़ बीनने वाले, घरेलू कामगार, स्ट्रीट वेंडर, निर्माण मजदूर, धोबी, रिक्शा चालक, मोची आदि।",
    "used_by_count": 1,
    "used_by": ["ab-pmjay"]
  },
  {
    "id": "household.has_lpg",
    "type": "boolean",
    "label_en": "Does your household already have an LPG connection?",
    "label_hi": "क्या आपके घर में पहले से LPG कनेक्शन है?",
    "hint_en": "Any LPG connection in any household member's name disqualifies from PM Ujjwala.",
    "hint_hi": "किसी भी घर के सदस्य के नाम पर कोई भी LPG कनेक्शन PM उज्ज्वला से अयोग्य करता है।",
    "used_by_count": 1,
    "used_by": ["pmuy"]
  },
  {
    "id": "household.in_priority_group",
    "type": "boolean",
    "label_en": "Does your household belong to a priority group (forest dwellers, MBC, tea garden tribes, river island residents)?",
    "label_hi": "क्या आपका परिवार किसी प्राथमिकता समूह से है (वन निवासी, अत्यंत पिछड़ा वर्ग, चाय बागान जनजाति, नदी द्वीप निवासी)?",
    "hint_en": "Priority groups under PM Ujjwala 2.0 for households without LPG.",
    "hint_hi": "PM उज्ज्वला 2.0 के तहत LPG रहित घरों के लिए प्राथमिकता समूह।",
    "used_by_count": 1,
    "used_by": ["pmuy"]
  },
  {
    "id": "household.is_pmay_beneficiary",
    "type": "boolean",
    "label_en": "Is your household a beneficiary of PM Awaas Yojana (PMAY)?",
    "label_hi": "क्या आपका परिवार PM आवास योजना (PMAY) का लाभार्थी है?",
    "hint_en": "Either PMAY-Gramin or PMAY-Urban beneficiary status counts.",
    "hint_hi": "PMAY-ग्रामीण या PMAY-शहरी लाभार्थी स्थिति में से कोई भी मान्य है।",
    "used_by_count": 1,
    "used_by": ["pmuy"]
  },
  {
    "id": "household.landless_manual_labour",
    "type": "boolean",
    "label_en": "Is your household primarily dependent on manual casual labour with no land?",
    "label_hi": "क्या आपका परिवार मुख्य रूप से बिना जमीन के अनौपचारिक मजदूरी पर निर्भर है?",
    "hint_en": "Families who earn a living through daily wage manual labour and own no agricultural land.",
    "hint_hi": "वे परिवार जो दैनिक मजदूरी से जीविका चलाते हैं और जिनके पास कोई कृषि भूमि नहीं है।",
    "used_by_count": 1,
    "used_by": ["ab-pmjay"]
  },
  {
    "id": "household.no_adult_16_59",
    "type": "boolean",
    "label_en": "Does your household have no adult member aged 16 to 59?",
    "label_hi": "क्या आपके परिवार में 16 से 59 वर्ष की आयु का कोई वयस्क सदस्य नहीं है?",
    "hint_en": "Households with only children or elderly members (no working-age adult).",
    "hint_hi": "केवल बच्चों या बुजुर्गों वाले परिवार (कोई कामकाजी उम्र का वयस्क नहीं)।",
    "used_by_count": 1,
    "used_by": ["ab-pmjay"]
  },
  {
    "id": "household.no_adult_male_16_59",
    "type": "boolean",
    "label_en": "Does your household have no male adult member aged 16 to 59?",
    "label_hi": "क्या आपके परिवार में 16 से 59 वर्ष की आयु का कोई पुरुष वयस्क सदस्य नहीं है?",
    "hint_en": "Female-headed households or households with only elderly/disabled male adults.",
    "hint_hi": "महिला प्रधान परिवार या केवल बुजुर्ग/दिव्यांग पुरुष वयस्कों वाले परिवार।",
    "used_by_count": 1,
    "used_by": ["ab-pmjay"]
  },
  {
    "id": "household.ration_card_type",
    "type": "enum",
    "options": [
      { "value": "none",       "label_en": "No ration card",                               "label_hi": "कोई राशन कार्ड नहीं" },
      { "value": "apl",        "label_en": "APL (Above Poverty Line) – White",             "label_hi": "APL (गरीबी रेखा से ऊपर) – सफेद" },
      { "value": "bpl",        "label_en": "BPL (Below Poverty Line) – Yellow/Orange",     "label_hi": "BPL (गरीबी रेखा से नीचे) – पीला/नारंगी" },
      { "value": "aay",        "label_en": "AAY (Antyodaya Anna Yojana) – Yellow",         "label_hi": "AAY (अंत्योदय अन्न योजना) – पीला" },
      { "value": "annapurna",  "label_en": "Annapurna – Green",                            "label_hi": "अन्नपूर्णा – हरा" },
      { "value": "yellow",     "label_en": "Yellow (Maharashtra BPL)",                     "label_hi": "पीला (महाराष्ट्र BPL)" },
      { "value": "orange",     "label_en": "Orange (Maharashtra – Priority Household)",    "label_hi": "नारंगी (महाराष्ट्र – प्राथमिकता परिवार)" },
      { "value": "white",      "label_en": "White (Maharashtra – Non-priority / APL)",     "label_hi": "सफेद (महाराष्ट्र – गैर-प्राथमिकता / APL)" }
    ],
    "label_en": "What type of ration card does your household have?",
    "label_hi": "आपके परिवार के पास किस प्रकार का राशन कार्ड है?",
    "hint_en": "Select the colour/type of ration card issued to your family.",
    "hint_hi": "अपने परिवार को जारी राशन कार्ड का रंग/प्रकार चुनें।",
    "used_by_count": 1,
    "used_by": ["mjpjay"]
  },
  {
    "id": "household.used_housing_scheme_before",
    "type": "boolean",
    "label_en": "Has your household previously benefited from any central or state housing scheme?",
    "label_hi": "क्या आपके परिवार ने पहले किसी केंद्रीय या राज्य आवास योजना का लाभ उठाया है?",
    "hint_en": "Includes Indira Awaas Yojana, PMAY, Rajiv Awaas Yojana, or any equivalent scheme.",
    "hint_hi": "इसमें इंदिरा आवास योजना, PMAY, राजीव आवास योजना, या कोई समकक्ष योजना शामिल है।",
    "used_by_count": 1,
    "used_by": ["pmay-u"]
  },
  {
    "id": "is_devadasi",
    "type": "boolean",
    "label_en": "Are you a Devadasi (a woman dedicated to a deity by social/religious custom)?",
    "label_hi": "क्या आप देवदासी हैं (सामाजिक/धार्मिक प्रथा द्वारा किसी देवता को समर्पित महिला)?",
    "hint_en": "This is a recognised vulnerable category under Maharashtra social welfare schemes.",
    "hint_hi": "यह महाराष्ट्र सामाजिक कल्याण योजनाओं के तहत एक मान्यता प्राप्त संवेदनशील श्रेणी है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_divorced_without_alimony",
    "type": "boolean",
    "label_en": "Are you divorced and not receiving any alimony or maintenance?",
    "label_hi": "क्या आप तलाकशुदा हैं और कोई भरण-पोषण या गुजारा भत्ता नहीं मिल रहा है?",
    "hint_en": "A divorce certificate and affidavit of no alimony may be required.",
    "hint_hi": "तलाक प्रमाणपत्र और भरण-पोषण न मिलने का हलफनामा आवश्यक हो सकता है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_loan_defaulter",
    "type": "boolean",
    "label_en": "Are you currently a wilful loan defaulter at any bank or financial institution?",
    "label_hi": "क्या आप वर्तमान में किसी बैंक या वित्तीय संस्था में जानबूझकर ऋण चूककर्ता हैं?",
    "hint_en": "Wilful defaulters are not eligible for PM Mudra Yojana loans.",
    "hint_hi": "जानबूझकर चूककर्ता PM मुद्रा योजना ऋण के लिए पात्र नहीं हैं।",
    "used_by_count": 1,
    "used_by": ["pmmy"]
  },
  {
    "id": "is_only_unmarried_woman_in_family",
    "type": "boolean",
    "label_en": "Are you the only unmarried woman in your family?",
    "label_hi": "क्या आप अपने परिवार में एकमात्र अविवाहित महिला हैं?",
    "hint_en": "Required condition for unmarried women applying for Majhi Ladki Bahin Yojana.",
    "hint_hi": "माझी लाडकी बहीण योजना के लिए आवेदन करने वाली अविवाहित महिलाओं के लिए आवश्यक शर्त।",
    "used_by_count": 1,
    "used_by": ["mmlby"]
  },
  {
    "id": "is_orphan",
    "type": "boolean",
    "label_en": "Are you an orphan (both parents deceased with no guardian support)?",
    "label_hi": "क्या आप अनाथ हैं (दोनों माता-पिता का निधन हो गया है और कोई संरक्षक नहीं है)?",
    "hint_en": "A certificate from the local authority may be required.",
    "hint_hi": "स्थानीय प्राधिकरण से प्रमाण पत्र आवश्यक हो सकता है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_prisoner_spouse",
    "type": "boolean",
    "label_en": "Is your spouse currently imprisoned (serving a sentence of more than 3 years)?",
    "label_hi": "क्या आपका जीवनसाथी वर्तमान में कारागार में है (3 वर्ष से अधिक की सजा काट रहा है)?",
    "hint_en": "A certificate from the jail authority confirming imprisonment is required.",
    "hint_hi": "कारागार प्राधिकरण से कारावास की पुष्टि करने वाला प्रमाण पत्र आवश्यक है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_rescued_trafficking_survivor",
    "type": "boolean",
    "label_en": "Are you a survivor of human trafficking who has been officially rescued?",
    "label_hi": "क्या आप मानव तस्करी के शिकार हैं जिन्हें आधिकारिक रूप से बचाया गया है?",
    "hint_en": "An official rescue certificate from the police or NGO partner is required.",
    "hint_hi": "पुलिस या NGO भागीदार से आधिकारिक बचाव प्रमाणपत्र आवश्यक है।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_street_vendor",
    "type": "boolean",
    "label_en": "Are you a street vendor or hawker who sells goods/services on the street?",
    "label_hi": "क्या आप एक स्ट्रीट वेंडर या फेरीवाले हैं जो सड़क पर सामान/सेवाएँ बेचते हैं?",
    "hint_en": "Includes vegetable sellers, fruit sellers, cooked food vendors, tea stalls, etc.",
    "hint_hi": "इसमें सब्जी विक्रेता, फल विक्रेता, पका हुआ खाना बेचने वाले, चाय की दुकानें आदि शामिल हैं।",
    "used_by_count": 1,
    "used_by": ["pm-svanidhi"]
  },
  {
    "id": "is_transgender",
    "type": "boolean",
    "label_en": "Do you identify as transgender?",
    "label_hi": "क्या आप ट्रांसजेंडर के रूप में पहचान करते हैं?",
    "hint_en": "As per the Transgender Persons (Protection of Rights) Act 2019.",
    "hint_hi": "ट्रांसजेंडर व्यक्ति (अधिकारों का संरक्षण) अधिनियम 2019 के अनुसार।",
    "used_by_count": 1,
    "used_by": ["sgngs"]
  },
  {
    "id": "is_unorganised_worker",
    "type": "boolean",
    "label_en": "Are you an unorganised sector worker (not covered by ESIC / EPFO)?",
    "label_hi": "क्या आप असंगठित क्षेत्र के कामगार हैं (ESIC / EPFO के अंतर्गत नहीं)?",
    "hint_en": "Includes home-based workers, self-employed workers, or daily wage workers not covered under formal employment.",
    "hint_hi": "इसमें घर-आधारित कामगार, स्व-रोजगार कामगार, या औपचारिक रोजगार के अंतर्गत नहीं आने वाले दैनिक मजदूर शामिल हैं।",
    "used_by_count": 1,
    "used_by": ["pm-sym"]
  },
  {
    "id": "land_hectares",
    "type": "number",
    "min": 0,
    "label_en": "How many hectares of agricultural land do you own (in your own name)?",
    "label_hi": "आपके अपने नाम पर कितने हेक्टेयर कृषि भूमि है?",
    "hint_en": "1 hectare = 2.47 acres. Enter total land area as per your land records.",
    "hint_hi": "1 हेक्टेयर = 2.47 एकड़। अपने भूमि अभिलेखों के अनुसार कुल भूमि क्षेत्र दर्ज करें।",
    "used_by_count": 1,
    "used_by": ["pmkmdy"]
  },
  {
    "id": "monthly_income",
    "type": "integer",
    "min": 0,
    "label_en": "What is your total monthly income from all sources (in rupees)?",
    "label_hi": "सभी स्रोतों से आपकी कुल मासिक आय (रुपयों में) क्या है?",
    "hint_en": "Include wages, business income, and any other earnings.",
    "hint_hi": "मजदूरी, व्यावसायिक आय और किसी अन्य कमाई को शामिल करें।",
    "used_by_count": 1,
    "used_by": ["pm-sym"]
  },
  {
    "id": "name_in_land_records_aug2019",
    "type": "boolean",
    "label_en": "Was your name recorded in the land records as of August 2019?",
    "label_hi": "क्या आपका नाम अगस्त 2019 तक भूमि अभिलेखों में दर्ज था?",
    "hint_en": "PM Kisan Maandhan eligibility requires land ownership on record before 01 August 2019.",
    "hint_hi": "PM किसान मानधन पात्रता के लिए 01 अगस्त 2019 से पहले भूमि स्वामित्व का रिकॉर्ड आवश्यक है।",
    "used_by_count": 1,
    "used_by": ["pmkmdy"]
  },
  {
    "id": "owns_land_in_own_name",
    "type": "boolean",
    "label_en": "Do you own agricultural land in your own name (not joint family / shared)?",
    "label_hi": "क्या आपके अपने नाम पर कृषि भूमि है (संयुक्त परिवार / साझा नहीं)?",
    "hint_en": "The land must be individually recorded in your name in official revenue records.",
    "hint_hi": "भूमि आधिकारिक राजस्व अभिलेखों में आपके नाम पर व्यक्तिगत रूप से दर्ज होनी चाहिए।",
    "used_by_count": 1,
    "used_by": ["pmkmdy"]
  },
  {
    "id": "vendor_status",
    "type": "enum",
    "options": [
      { "value": "has_certificate_or_id", "label_en": "I have a Certificate of Vending or Identity Card issued by ULB", "label_hi": "मेरे पास ULB द्वारा जारी वेंडिंग प्रमाणपत्र या पहचान पत्र है" },
      { "value": "identified_in_survey",  "label_en": "I was identified in the Town Vending Committee survey",         "label_hi": "मुझे टाउन वेंडिंग कमेटी सर्वेक्षण में पहचाना गया था" },
      { "value": "has_lor",              "label_en": "I have a Letter of Recommendation (LoR) from the ULB/TVC",     "label_hi": "मेरे पास ULB/TVC से सिफारिश पत्र (LoR) है" },
      { "value": "none",                 "label_en": "I have none of the above documents",                           "label_hi": "मेरे पास उपरोक्त में से कोई दस्तावेज़ नहीं है" }
    ],
    "label_en": "What is your official status as a street vendor?",
    "label_hi": "एक स्ट्रीट वेंडर के रूप में आपकी आधिकारिक स्थिति क्या है?",
    "hint_en": "ULB = Urban Local Body (municipality). TVC = Town Vending Committee.",
    "hint_hi": "ULB = शहरी स्थानीय निकाय (नगर पालिका)। TVC = टाउन वेंडिंग कमेटी।",
    "used_by_count": 1,
    "used_by": ["pm-svanidhi"]
  },
  {
    "id": "wants_business_loan",
    "type": "boolean",
    "label_en": "Are you looking for a loan to start or grow a small business?",
    "label_hi": "क्या आप छोटा व्यवसाय शुरू करने या बढ़ाने के लिए ऋण की तलाश में हैं?",
    "hint_en": "PM Mudra Yojana provides collateral-free loans up to Rs 10 lakh for non-farm micro enterprises.",
    "hint_hi": "PM मुद्रा योजना गैर-कृषि सूक्ष्म उद्यमों के लिए 10 लाख रुपये तक के बिना जमानत के ऋण प्रदान करती है।",
    "used_by_count": 1,
    "used_by": ["pmmy"]
  },

]  # end FIELDS

# fmt: on

catalog = {
  "_meta": {
    "total_fields": len(FIELDS),
    "description": "Master field catalog for the government scheme eligibility engine.",
    "note": "Fields are sorted by used_by_count (descending). Each field has English and Hindi labels, type info, and the list of scheme IDs that use it."
  },
  "fields": FIELDS
}

OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Done — wrote {len(FIELDS)} fields to {OUT}")
