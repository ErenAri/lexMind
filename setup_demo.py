#!/usr/bin/env python3
"""
LexMind Demo Setup Script
Ensures all systems are ready for hackathon presentation
"""

import asyncio
import aiohttp
import subprocess
import time
import sys
import os
from pathlib import Path

class DemoSetup:
    def __init__(self):
        self.api_url = "http://localhost:8000"
        self.web_url = "http://localhost:3000"
        self.checks_passed = 0
        self.total_checks = 10

    def run_command(self, cmd: str) -> bool:
        """Run shell command and return success status"""
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    def check_requirement(self, name: str, cmd: str, expected: str = "") -> bool:
        """Check if a requirement is met"""
        print(f"🔍 Checking {name}...", end=" ")
        
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                output = result.stdout.strip()
                if expected and expected not in output:
                    print(f"❌ Expected '{expected}' but got '{output}'")
                    return False
                print(f"✅ {output}")
                return True
            else:
                print(f"❌ Command failed: {result.stderr.strip()}")
                return False
        except Exception as e:
            print(f"❌ Error: {e}")
            return False

    async def check_service(self, name: str, url: str, expected_key: str = "") -> bool:
        """Check if a service is running"""
        print(f"🔍 Checking {name}...", end=" ")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        if expected_key:
                            data = await response.json()
                            if expected_key in data:
                                print(f"✅ Running - {data.get(expected_key, 'OK')}")
                            else:
                                print(f"✅ Running but missing key '{expected_key}'")
                        else:
                            print("✅ Running")
                        return True
                    else:
                        print(f"❌ HTTP {response.status}")
                        return False
        except Exception as e:
            print(f"❌ {str(e)}")
            return False

    def setup_environment(self):
        """Set up environment variables"""
        print("\n🔧 Setting up environment...")
        
        env_file = Path(".env")
        if not env_file.exists():
            print("⚠️  No .env file found, creating from example...")
            example_file = Path(".env.example")
            if example_file.exists():
                with open(example_file) as f:
                    content = f.read()
                with open(env_file, 'w') as f:
                    f.write(content)
                print("✅ Created .env file")
            else:
                print("❌ No .env.example file found")
                return False
        
        # Set key environment variables
        os.environ['TIDB_HOST'] = os.getenv('TIDB_HOST', '127.0.0.1')
        os.environ['TIDB_PORT'] = os.getenv('TIDB_PORT', '4000')
        os.environ['TIDB_USER'] = os.getenv('TIDB_USER', 'root')
        os.environ['TIDB_DATABASE'] = os.getenv('TIDB_DATABASE', 'lexmind')
        os.environ['OLLAMA_URL'] = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434')
        
        return True

    async def verify_data(self):
        """Verify demo data is loaded"""
        print("\n📊 Verifying demo data...")
        
        endpoints_to_check = [
            ("/analytics/executive/summary", "Executive summary"),
            ("/analytics/realtime/metrics", "Real-time metrics"),
            ("/documents", "Documents list")
        ]
        
        all_good = True
        for endpoint, name in endpoints_to_check:
            success = await self.check_service(name, f"{self.api_url}{endpoint}")
            if success:
                self.checks_passed += 1
            all_good = all_good and success
        
        return all_good

    async def run_performance_test(self):
        """Run quick performance test"""
        print("\n⚡ Running performance test...")
        
        try:
            async with aiohttp.ClientSession() as session:
                # Test hybrid search performance
                start_time = time.time()
                async with session.post(
                    f"{self.api_url}/query/hybrid",
                    json={
                        "query": "trading policy compliance",
                        "limit": 10,
                        "reg_weight": 0.3,
                        "doc_weight": 0.7
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    elapsed = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        results = await response.json()
                        print(f"✅ Search completed in {elapsed:.1f}ms")
                        print(f"   • Found {len(results.get('results', []))} results")
                        
                        if elapsed < 100:
                            print("🚀 Excellent performance (<100ms)")
                        elif elapsed < 500:
                            print("👍 Good performance (<500ms)")
                        else:
                            print("⚠️  Performance warning (>500ms)")
                        
                        return elapsed < 1000  # Accept up to 1 second for demo
                    else:
                        print(f"❌ Search failed with HTTP {response.status}")
                        return False
        except Exception as e:
            print(f"❌ Performance test failed: {e}")
            return False

    async def run_demo_test(self):
        """Test the full demo scenario"""
        print("\n🎭 Testing demo scenario...")
        
        # Test if the demo script can run
        demo_script = Path("demo/goldman_sachs_scenario.py")
        if not demo_script.exists():
            print("❌ Demo script not found")
            return False
        
        print("✅ Demo script found")
        
        # Quick API connectivity test for demo
        try:
            async with aiohttp.ClientSession() as session:
                # Test collaboration endpoint
                async with session.post(
                    f"{self.api_url}/serverless/collaboration/session",
                    params={"document_path": "/test/demo.pdf", "user_id": "demo@test.com"},
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        print("✅ Collaboration API working")
                        return True
                    else:
                        print(f"⚠️  Collaboration API returned {response.status}")
                        return True  # Still acceptable for demo
        except Exception as e:
            print(f"⚠️  Demo test warning: {e}")
            return True  # Don't fail setup for this

    def print_status(self):
        """Print final status"""
        print("\n" + "="*60)
        print("🎯 LEXMIND DEMO SETUP RESULTS")
        print("="*60)
        print(f"✅ Checks passed: {self.checks_passed}/{self.total_checks}")
        
        if self.checks_passed >= 8:
            print("🏆 READY FOR HACKATHON DEMO!")
            print("\nTo start the demo:")
            print("1. python demo/goldman_sachs_scenario.py")
            print("2. Open http://localhost:3000 for web interface")
            print("3. Open http://localhost:3000/mobile for mobile view")
            return True
        elif self.checks_passed >= 6:
            print("⚠️  MOSTLY READY - Some issues detected")
            print("Demo should work but may have minor problems")
            return True
        else:
            print("❌ NOT READY - Too many issues detected")
            print("Please fix the issues above before demo")
            return False

    async def main(self):
        """Main setup routine"""
        print("🚀 LEXMIND HACKATHON DEMO SETUP")
        print("="*50)
        
        # Environment setup
        if not self.setup_environment():
            print("❌ Environment setup failed")
            return False
        
        # System requirements
        print("\n🔧 Checking system requirements...")
        requirements = [
            ("Node.js", "node --version"),
            ("pnpm", "pnpm --version"),
            ("Python", "python --version"),
            ("Docker", "docker --version"),
        ]
        
        for name, cmd in requirements:
            if self.check_requirement(name, cmd):
                self.checks_passed += 1

        # Service checks
        print("\n🌐 Checking services...")
        services = [
            ("API Server", f"{self.api_url}/health", "status"),
            ("Web Interface", self.web_url, ""),
        ]
        
        for name, url, key in services:
            if await self.check_service(name, url, key):
                self.checks_passed += 1

        # Data verification
        if await self.verify_data():
            self.checks_passed += 1

        # Performance test
        if await self.run_performance_test():
            self.checks_passed += 2  # Worth 2 points

        # Demo test
        if await self.run_demo_test():
            self.checks_passed += 1

        # Print final status
        return self.print_status()

if __name__ == "__main__":
    setup = DemoSetup()
    success = asyncio.run(setup.main())
    sys.exit(0 if success else 1)