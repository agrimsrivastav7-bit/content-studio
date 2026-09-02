import os
import time
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document

# Load environment variables from backend/.env explicitly
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"))

# 60+ Real Estate facts for the DLF Knowledge Base with metadata tagging
KNOWLEDGE_BASE = [
    # The Camellias
    {"text": "The Camellias is located in Sector 42, DLF Phase 5, Gurugram, offering super-luxury residences.", "project": "camellias", "category": "location"},
    {"text": "The Camellias has RERA Registration Number: HRERA-406/2017.", "project": "camellias", "category": "legal"},
    {"text": "Unit sizes at The Camellias range from 7,300 sq ft to 15,000 sq ft for penthouses.", "project": "camellias", "category": "specification"},
    {"text": "The Camellias features a magnificent 1.3L sq ft clubhouse designed for unparalleled wellness and social recreation.", "project": "camellias", "category": "amenity"},
    {"text": "The Camellias overlooks a 200-acre lush green golf course and the ancient Aravalli hills.", "project": "camellias", "category": "location"},
    {"text": "The architecture of The Camellias focuses on clean lines and structural harmony with nature.", "project": "camellias", "category": "brand"},
    {"text": "The Camellias offers exclusive concierge services and a private 75-seater cinema.", "project": "camellias", "category": "amenity"},
    {"text": "The Camellias features multiple dining venues including a multi-cuisine restaurant and a sports bar.", "project": "camellias", "category": "amenity"},
    {"text": "The Camellias spa features Turkish hammams and vitality pools.", "project": "camellias", "category": "amenity"},
    {"text": "The Camellias is LEED Platinum certified for sustainable design.", "project": "camellias", "category": "legal"},
    {"text": "Only 429 limited edition residences are available at The Camellias.", "project": "camellias", "category": "specification"},
    {"text": "Each apartment at The Camellias features clear 10.5 ft floor-to-ceiling heights.", "project": "camellias", "category": "specification"},
    {"text": "The Camellias has a dedicated wine cellar and tasting room for residents.", "project": "camellias", "category": "amenity"},
    {"text": "The project was designed by Hafeez Contractor with interiors by Shawn Sullivan of Rockwell Group.", "project": "camellias", "category": "brand"},
    {"text": "At The Camellias, there is a strict commitment to grand-scale, bespoke living.", "project": "camellias", "category": "brand"},

    # DLF Privana
    {"text": "DLF Privana South is located in Sector 76-77, Gurugram, seamlessly blending modern luxury with the Aravalli hills.", "project": "privana", "category": "location"},
    {"text": "DLF Privana South is RERA registered under HRERA-29/2023.", "project": "privana", "category": "legal"},
    {"text": "Privana features 4 BHK apartments with carpet areas starting around 3,400 sq ft.", "project": "privana", "category": "specification"},
    {"text": "DLF Privana West is the second phase, extending the ecosystem with additional luxury towers.", "project": "privana", "category": "brand"},
    {"text": "The Privana ecosystem is spread across 116 acres of prime land.", "project": "privana", "category": "specification"},
    {"text": "Over 80% of the area in DLF Privana is dedicated to open green spaces.", "project": "privana", "category": "amenity"},
    {"text": "DLF Privana offers a 1 Lakh sq ft integrated clubhouse across phases.", "project": "privana", "category": "amenity"},
    {"text": "The project integrates walking trails and biodiversity zones mimicking the Aravalli flora.", "project": "privana", "category": "location"},
    {"text": "Each Privana tower features expansive wrap-around balconies for panoramic views.", "project": "privana", "category": "specification"},
    {"text": "Privana South sold out entirely within 72 hours of its launch, highlighting immense demand.", "project": "privana", "category": "brand"},
    {"text": "DLF Privana provides 3 car parking slots per 4 BHK apartment.", "project": "privana", "category": "specification"},
    {"text": "The project is strategically close to NH-8, SPR, and the upcoming Cyber City 2.", "project": "privana", "category": "location"},

    # The Magnolias
    {"text": "The Magnolias is situated on Golf Course Road, DLF Phase 5, Gurugram.", "project": "magnolias", "category": "location"},
    {"text": "It consists of 19 towers offering 4 and 5 BHK luxury apartments and penthouses.", "project": "magnolias", "category": "specification"},
    {"text": "Apartment sizes at The Magnolias range from 6,360 sq ft to 12,230 sq ft.", "project": "magnolias", "category": "specification"},
    {"text": "Club Magnolia features a spectacular Olympic-length swimming pool.", "project": "magnolias", "category": "amenity"},
    {"text": "The Magnolias provides direct, spectacular views of the DLF Golf & Country Club.", "project": "magnolias", "category": "location"},
    {"text": "The Magnolias has its own integrated bakery, salon, and fine dining restaurant.", "project": "magnolias", "category": "amenity"},
    {"text": "A robust 3-tier security system ensures absolute privacy for The Magnolias residents.", "project": "magnolias", "category": "amenity"},
    {"text": "The Magnolias set the original benchmark for ultra-luxury living in India.", "project": "magnolias", "category": "brand"},
    {"text": "Each apartment was handed over in bare-shell condition, allowing bespoke interior customization.", "project": "magnolias", "category": "specification"},

    # The Aralias
    {"text": "The Aralias is the pioneering super-luxury project in DLF Phase 5.", "project": "aralias", "category": "brand"},
    {"text": "It is located adjacent to the DLF Golf and Country Club.", "project": "aralias", "category": "location"},
    {"text": "The Aralias offers exclusively 4 BHK apartments and penthouses.", "project": "aralias", "category": "specification"},
    {"text": "Unit sizes at The Aralias range from 5,500 sq ft to 10,000 sq ft.", "project": "aralias", "category": "specification"},
    {"text": "The Aralias clubhouse includes a state-of-the-art gym, tennis courts, and squash courts.", "project": "aralias", "category": "amenity"},
    {"text": "The Aralias introduced the concept of bare-shell apartments to the Indian luxury market.", "project": "aralias", "category": "brand"},
    {"text": "It comprises 11 mid-rise towers integrated into the natural landscape.", "project": "aralias", "category": "specification"},

    # The Crest
    {"text": "The Crest is an ultra-luxury project located in Sector 54, DLF Phase 5.", "project": "crest", "category": "location"},
    {"text": "The Crest is RERA registered under HRERA-123/2017 (Sample placeholder).", "project": "crest", "category": "legal"},
    {"text": "The Crest comprises 6 stunning towers designed by Hafeez Contractor.", "project": "crest", "category": "specification"},
    {"text": "It offers 2, 3, 4, and 5 BHK apartments starting from 2,225 sq ft up to 6,221 sq ft.", "project": "crest", "category": "specification"},
    {"text": "The Crest features high-speed Kone destination control elevators.", "project": "crest", "category": "amenity"},
    {"text": "The Crest clubhouse, managed by an international hospitality brand, offers a resort-like pool.", "project": "crest", "category": "amenity"},
    {"text": "The project incorporates IGBC Gold-rated green building standards.", "project": "crest", "category": "legal"},
    {"text": "Each apartment at The Crest includes fully fitted modular kitchens with premium appliances.", "project": "crest", "category": "specification"},
    {"text": "The Crest boasts expansive private decks with seamless glass railings.", "project": "crest", "category": "specification"},
    {"text": "The Crest's master plan includes a central lagoon and dense landscaping.", "project": "crest", "category": "amenity"},

    # General DLF Corporate Facts
    {"text": "DLF Limited was founded in 1946 by Chaudhary Raghvendra Singh.", "project": "none", "category": "brand"},
    {"text": "DLF is India's largest publicly listed real estate company.", "project": "none", "category": "brand"},
    {"text": "DLF Cyber City in Gurugram is India's largest integrated business district.", "project": "none", "category": "location"},
    {"text": "DLF Homes blends Indian heritage with modern architectural excellence.", "project": "none", "category": "brand"},
    {"text": "DLF phase 5 in Gurugram is widely considered India's most exclusive pin code.", "project": "none", "category": "location"},
    {"text": "True luxury at DLF is not just defined by materials, but by the passions cultivated within the home.", "project": "none", "category": "brand"},
    {"text": "DLF properties are known for uncompromising detail and architectural harmony with nature.", "project": "none", "category": "brand"},
    {"text": "DLF private relationship managers provide bespoke consultative services.", "project": "none", "category": "brand"},
    {"text": "DLF strictly adheres to all RERA compliance norms across its active portfolio.", "project": "none", "category": "legal"},
    {"text": "DLF has developed over 150 real estate projects covering millions of square feet.", "project": "none", "category": "brand"},
]

def ingest_data():
    print("Initializing Google Generative AI Embeddings...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
    
    print(f"Preparing {len(KNOWLEDGE_BASE)} documents with metadata...")
    documents = [
        Document(
            page_content=fact["text"], 
            metadata={
                "source": "dlf_knowledge_base",
                "project": fact["project"],
                "category": fact["category"]
            }
        ) 
        for fact in KNOWLEDGE_BASE
    ]
    
    db_dir = os.path.join(os.path.dirname(__file__), "chroma_db")
    print(f"Creating ChromaDB vector store at {db_dir}...")
    
    # Initialize empty vector store first
    vectorstore = Chroma(
        embedding_function=embeddings,
        persist_directory=db_dir,
        collection_name="dlf_properties"
    )
    
    # Add documents in batches to avoid 429 Rate Limit
    batch_size = 5
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        print(f"Adding batch {i//batch_size + 1}/{(len(documents)-1)//batch_size + 1} ({len(batch)} documents)...")
        
        for attempt in range(5):
            try:
                vectorstore.add_documents(batch)
                break
            except Exception as e:
                if attempt == 4:
                    raise e
                print(f"Rate limited, waiting {15 * (attempt+1)} seconds...")
                time.sleep(15 * (attempt+1))
                
        time.sleep(10) # Wait 10 seconds between batches
        
    print("Successfully ingested knowledge base into ChromaDB!")
    
if __name__ == "__main__":
    if not os.getenv("GOOGLE_API_KEY"):
        print("ERROR: GOOGLE_API_KEY environment variable is not set.")
        exit(1)
    
    ingest_data()
