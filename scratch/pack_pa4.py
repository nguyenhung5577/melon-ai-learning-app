import os
import shutil
import zipfile

def pack_pa4():
    base_dir = r"d:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app"
    pa4_dir = os.path.join(base_dir, "pa", "pa4")
    group_dir = os.path.join(pa4_dir, "PA4-Group02")
    
    if os.path.exists(group_dir):
        shutil.rmtree(group_dir)
    os.makedirs(group_dir)
    
    # 1. Copy documents
    docs = ["Test plan.docx", "Test cases.md", "Test report.md", "Test cases.docx", "Test report.docx"]
    for d in docs:
        src = os.path.join(pa4_dir, d)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(group_dir, d))
            
    # 2. Copy automated tests
    auto_tests_dir = os.path.join(group_dir, "Automated_Tests")
    os.makedirs(auto_tests_dir)
    
    frontend_src = os.path.join(base_dir, "src", "web", "tests")
    frontend_dst = os.path.join(auto_tests_dir, "Frontend_Tests")
    if os.path.exists(frontend_src):
        shutil.copytree(frontend_src, frontend_dst, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", "test-results"))
        
    backend_src = os.path.join(base_dir, "src", "melon-ai-backend", "tests")
    backend_dst = os.path.join(auto_tests_dir, "Backend_Tests")
    if os.path.exists(backend_src):
        shutil.copytree(backend_src, backend_dst, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache"))
        
    # 3. Zip it
    zip_path = os.path.join(pa4_dir, "PA4-Group02.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(group_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, pa4_dir)
                zipf.write(file_path, arcname)
                
    print(f"Successfully created {zip_path}")

if __name__ == "__main__":
    pack_pa4()
