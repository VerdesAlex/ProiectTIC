@echo off
title LocalMind AI Tunnel
cd /d G:/Master Oogway/An1/TIC/ProiectTIC/Cloudflared/
echo Pornesc tunelul Cloudflare pentru LocalMind...
cloudflared tunnel --url http://localhost:1234
pause