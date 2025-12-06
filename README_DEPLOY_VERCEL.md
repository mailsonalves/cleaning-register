# Deploy no Vercel — instruções rápidas

1. Push este repositório para um remoto (GitHub/GitLab/Bitbucket).

2. No Vercel: crie um novo projeto e conecte ao repositório.

3. Variáveis de ambiente (Settings -> Environment Variables):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   Configure os mesmos valores para `Preview` e `Production`.

4. Build & Output Settings (geralmente detectado automaticamente):
   - Framework Preset: `Other` (ou `Vite` se detectado)
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. Requisitos de Firebase:
   - Ative Anonymous Authentication no console do Firebase (Authentication -> Sign-in method -> Anonymous).
   - Garanta que suas regras do Firestore permitam gravações por usuários autenticados (ex.: `request.auth != null`) ou ajuste temporariamente para desenvolvimento.

6. URLs e testes
   - Após deploy, abra a URL do projeto e teste os dois cards (Limpeza e Compra de Água).

7. Observações de segurança
   - Não faça commit de credenciais públicas se não necessário. As variáveis Vite devem ser configuradas no painel do Vercel e não no repositório.
