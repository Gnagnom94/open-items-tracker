# Guida alla Pubblicazione

Questa estensione viene pubblicata automaticamente tramite GitHub Actions su **Open VSX** e **VS Code Marketplace**.

---

## Setup iniziale (una tantum)

### 1. Crea i Personal Access Token

| Marketplace | Dove creare il token | Secret GitHub |
|---|---|---|
| **Open VSX** | [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens) | `OVSX_PAT` |
| **VS Code Marketplace** *(opzionale)* | [dev.azure.com](https://dev.azure.com) → User Settings → Personal Access Tokens | `VSCE_PAT` |

> **Nota:** Per il VS Code Marketplace, il PAT deve avere lo scope `Marketplace > Manage`.

### 2. Aggiungi i token come GitHub Secrets

1. Vai su **GitHub → Repository → Settings → Secrets and variables → Actions**
2. Clicca **"New repository secret"**
3. Aggiungi `OVSX_PAT` con il valore del token Open VSX
4. *(Opzionale)* Aggiungi `VSCE_PAT` per pubblicare anche sul VS Code Marketplace

> Se `VSCE_PAT` non è configurato, il workflow pubblicherà solo su Open VSX senza errori.

---

## Come rilasciare una nuova versione

### 1. Aggiorna la versione in `package.json`

```json
"version": "<X.Y.Z>"
```

### 2. Aggiorna il `CHANGELOG.md`

Documenta le modifiche della nuova versione.

### 3. Committa e tagga

```bash
git add -A
git commit -m "chore: release v<X.Y.Z>"
git tag v<X.Y.Z>
git push origin main --tags
```

### 4. Il workflow fa il resto

Il push del tag `v*` triggera automaticamente il workflow che:

1. ✅ Verifica che la versione nel tag corrisponda a `package.json`
2. 📦 Builda e pacchettizza l'estensione (`.vsix`)
3. 🟢 Pubblica su Open VSX
4. 🔵 Pubblica su VS Code Marketplace *(se `VSCE_PAT` è configurato)*
5. 🏷️ Crea una GitHub Release con il `.vsix` allegato

---

## Pubblicazione manuale (dry run)

Puoi anche triggerare il workflow manualmente dal tab **Actions** su GitHub:

1. Vai su **Actions → Publish Extension → Run workflow**
2. Spunta **"Dry run"** se vuoi solo pacchettizzare senza pubblicare
3. Clicca **"Run workflow"**

---

## Pubblicazione locale (fallback)

Se per qualche motivo il CI/CD non funziona, puoi pubblicare manualmente:

```bash
# Pacchettizza
npm run release:package

# Pubblica su Open VSX (richiede OVSX_PAT come variabile d'ambiente)
npm run release:ovsx

# Pubblica su VS Code Marketplace (richiede VSCE_PAT come variabile d'ambiente)
npm run release:vsce
```

> **Tip:** Setta i token come variabili d'ambiente permanenti:
> ```powershell
> # PowerShell
> [System.Environment]::SetEnvironmentVariable("OVSX_PAT", "il-tuo-token", "User")
> [System.Environment]::SetEnvironmentVariable("VSCE_PAT", "il-tuo-token", "User")
> ```
