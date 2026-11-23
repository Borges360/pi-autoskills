# Pi Autoskills

**Package:** `@borges360/pi-autoskills` · **version:** `0.1.2`

**Status:** development release. Git source is documented below. npm registry availability and publication have not been verified; package metadata does not establish registry availability.

**Compatibility:** Node.js `>=22.19`. The package uses Pi extension APIs and declares `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` `>=1.5.2 <1.7.0` as peers. Tests run against `1.6.0`, and `npm run smoke:host` loads the extension with the Pi `1.6.0` loader installed locally. This does not establish a wider compatibility range.

## English

### What it does

Pi Autoskills discovers skills and playbooks from configured and trusted project roots, ranks them deterministically by task keywords, paths, and stack, then discloses only selected audited content with hash-pinned provenance. Explicit pins are respected. Optional delegation uses a synchronous ownership handshake with a specialist router.

The extension defaults to file storage. SQLite and Pi Durable are opt-in. It does not require a sibling extension, remote classifier, or database driver for its default path.

### Install and develop

The repository advertises this Pi Git installation path:

~~~sh
pi install git:github.com/Borges360/pi-autoskills
~~~

This installs from Git; it is not an npm registry installation. Registry availability remains unverified until CT59.

For development, use the locked dependencies in `package-lock.json`, then run the local checks:

~~~sh
npm test
npm run build
npm run lint
npm run benchmark
npm pack --dry-run
~~~

The Pi extension entry point is `src/extension.ts`. The package also provides the `pi-autoskills` CLI at `dist/cli.js`.

### Use

Run `/autoskills` (or `/autoskills config`) to open the interactive menu; it opens without running any command. `/autoskills status` returns structured headless status. The panel lists the **Mode** and **Language** settings, then the read-only actions with their group in the value column: **Active** (Show selected skills), **Suggestions** (Explain selection, Detect context), **Agents** (Agents) and **Settings** (Doctor). Use ↑/↓ to move and Enter to edit a setting or run an action; action results are posted to the chat. Edits are drafts: **Ctrl+S** saves and keeps the panel open, and a failed save keeps the draft. Esc goes back from a list without applying, cancels a running action or save, and with unsaved changes warns first; a second Esc discards them and closes. An action that does not finish in time (30 s; Doctor 120 s) is stopped and reported as a timeout. If the project storage cannot start, the menu still opens: Mode can be saved, and Doctor (also `/autoskills doctor`) reports the cause and how to recover without changing anything. Ctrl+C stays with Pi. Automated tests drive the panel by keyboard bytes at 40, 80 and 120 columns; they do not replace a review in a real terminal.

Domain actions include `show`, `detect`, `explain`, `pin <skill...>`, `pin clear`, `agents`, `delegate <agent> <objective>`, `audit <file>`, `install <file-or-https-url> <sha256> <id>`, and `update <file-or-https-url> <sha256> <id>`. Shared actions include `auto`, `off`, `observe`, `config`, `doctor`, `storage status`, and `storage migrate files|sqlite|durable`. The CLI accepts the same actions; for example:

~~~sh
node dist/cli.js status
node dist/cli.js doctor
~~~

`install` and `update` change the selected skill root and catalog. Use them only with an explicit source and expected SHA-256. Delegation may create child processes or worktrees; these actions were not invoked in the documentation checks.

### Configuration and state

User settings live at `~/.pi/agent/state/pi-autoskills/config.json`; `PI_ECOSYSTEM_STATE_ROOT` changes the parent directory for tests or deployment. Project settings use `.pi/pi-autoskills.json` and are read only after Pi trusts the project. Precedence is command override, trusted project configuration, user configuration, then built-in defaults. Project configuration cannot raise user security limits.

Skills default to `~/.pi/agent/skills`, and agent definitions to `~/.pi/agent/agents`. Trusted projects may add `.pi/skills` and `.pi/agents`. The default mode is `auto`, storage is `files`, and write access is disabled. See [configuration](CONFIGURATION.md) for all settings.

### Language

This README is provided in English and Brazilian Portuguese. The menu starts in English. Choose **Language** in the menu to preview English or Português (Brasil) immediately; **Ctrl+S** saves the preference only for the trusted project at `.pi/pi-autoskills.locale.json`, and discarding the draft returns to the saved language. In a project Pi does not trust, the field is locked and shows why. Missing or invalid preferences fall back to English. CLI actions and structured outputs keep their stable command values.

### Privacy and security

Pi extensions run with the operating-system privileges of the user; this package is not an OS sandbox. Selected skill content can be disclosed to the model. Secrets are redacted at output boundaries, but heuristics cannot detect every arbitrary secret. Do not put secrets in objectives, definitions, or artifacts. See [security](SECURITY.md) for the full boundary.

Skill installation requires an explicit source, expected hash, successful static audit, and valid metadata. HTTPS fetches use timeout and size limits. Child credentials are allowlisted by environment-variable name; `auth.json` is not inherited.

### Troubleshooting and limits

Start with `node dist/cli.js doctor` and `node dist/cli.js status`. Use [architecture](ARCHITECTURE.md), [migration](MIGRATION.md), and [compatibility](COMPATIBILITY.md) for implementation and recovery details. The local storage benchmark makes no model quality or cost claim. See [acceptance evidence](ACCEPTANCE.md) and the [benchmark protocol](benchmarks/README.md).

### License

The software is MIT licensed; see [LICENSE](LICENSE). Third-party code bundled under `src/vendor/` is listed in [its notice](src/vendor/THIRD_PARTY_NOTICES.md).

## Português (Brasil)

### O que faz

O Pi Autoskills descobre skills e playbooks em raízes configuradas e projetos confiáveis, classifica os resultados de forma determinística por palavras-chave, caminhos e stack e revela somente o conteúdo selecionado e auditado, com proveniência vinculada por hash. Pins explícitos são respeitados. A delegação opcional usa uma confirmação síncrona de propriedade com um roteador especialista.

A extensão usa arquivos por padrão. SQLite e Pi Durable são opcionais. O caminho padrão não exige extensão irmã, classificador remoto ou driver de banco de dados.

### Instalação e desenvolvimento

O repositório informa este caminho de instalação Git no Pi:

~~~sh
pi install git:github.com/Borges360/pi-autoskills
~~~

Esse comando instala a partir do Git; não é uma instalação pela registry npm. A disponibilidade na registry continua sem verificação até CT59.

Para desenvolvimento, use as dependências travadas em `package-lock.json` e execute as verificações locais:

~~~sh
npm test
npm run build
npm run lint
npm run benchmark
npm pack --dry-run
~~~

A entrada da extensão Pi é `src/extension.ts`. O pacote também oferece a CLI `pi-autoskills` em `dist/cli.js`.

### Uso

Execute `/autoskills` (ou `/autoskills config`) para abrir o menu interativo; ele abre sem executar nenhum comando. `/autoskills status` retorna o estado estruturado para uso headless. O painel lista as configurações **Modo** e **Idioma** e depois as ações somente leitura, com o grupo na coluna de valor: **Ativas** (Exibir skills selecionadas), **Sugestões** (Explicar seleção, Detectar contexto), **Agentes** (Agentes) e **Configurações** (Diagnóstico). Use ↑/↓ para navegar e Enter para editar uma configuração ou executar uma ação; os resultados vão para o chat. Edições são rascunho: **Ctrl+S** salva e mantém o painel aberto, e uma falha ao salvar preserva o rascunho. Esc volta de uma lista sem aplicar, cancela uma ação ou um salvamento em andamento e, com alterações não salvas, primeiro avisa; o segundo Esc descarta e fecha. Uma ação que não termina a tempo (30 s; Diagnóstico 120 s) é interrompida e informada como tempo esgotado. Se o armazenamento do projeto não puder ser iniciado, o menu ainda abre: o Modo pode ser salvo, e o Diagnóstico (também `/autoskills doctor`) informa a causa e como recuperar, sem alterar nada. Ctrl+C continua com o Pi. Os testes automatizados dirigem o painel por bytes de teclado em 40, 80 e 120 colunas; eles não substituem uma revisão num terminal real.

As ações de domínio incluem `show`, `detect`, `explain`, `pin <skill...>`, `pin clear`, `agents`, `delegate <agent> <objective>`, `audit <file>`, `install <file-or-https-url> <sha256> <id>` e `update <file-or-https-url> <sha256> <id>`. Ações compartilhadas incluem `auto`, `off`, `observe`, `config`, `doctor`, `storage status` e `storage migrate files|sqlite|durable`. A CLI aceita as mesmas ações. Exemplos:

~~~sh
node dist/cli.js status
node dist/cli.js doctor
~~~

`install` e `update` alteram a raiz de skills escolhida e o catálogo. Use essas ações somente com origem explícita e SHA-256 esperado. Delegação pode criar processos filhos ou worktrees; essas ações não foram invocadas nas verificações da documentação.

### Configuração e estado

As preferências do usuário ficam em `~/.pi/agent/state/pi-autoskills/config.json`; `PI_ECOSYSTEM_STATE_ROOT` altera o diretório pai em testes ou implantação. Configurações do projeto ficam em `.pi/pi-autoskills.json` e só são lidas depois que o Pi confia no projeto. A precedência é override do comando, configuração de projeto confiável, configuração do usuário e defaults internos. A configuração do projeto não pode elevar limites de segurança do usuário.

Skills ficam por padrão em `~/.pi/agent/skills`, e definições de agentes em `~/.pi/agent/agents`. Projetos confiáveis podem adicionar `.pi/skills` e `.pi/agents`. O modo padrão é `auto`, o armazenamento é `files` e o acesso de escrita fica desabilitado. Consulte [configuração](CONFIGURATION.md) para todas as opções.

### Idioma

Este README está em inglês e português brasileiro. O menu começa em inglês. Escolha **Idioma** no menu para pré-visualizar inglês ou português (Brasil) na hora; **Ctrl+S** salva a preferência somente para o projeto confiável em `.pi/pi-autoskills.locale.json`, e descartar o rascunho volta ao idioma salvo. Em projeto que o Pi não considera confiável, o campo fica bloqueado e mostra o motivo. Preferências ausentes ou inválidas usam inglês como fallback. As ações da CLI e as saídas estruturadas mantêm seus valores estáveis.

### Privacidade e segurança

Extensões Pi executam com os privilégios do sistema operacional do usuário; este pacote não é um sandbox do sistema. Conteúdo de skills selecionadas pode ser revelado ao modelo. Segredos são redigidos nas saídas, mas heurísticas não detectam todos os segredos arbitrários. Não coloque segredos em objetivos, definições ou artefatos. Consulte [segurança](SECURITY.md) para a fronteira completa.

A instalação de skills exige origem explícita, hash esperado, auditoria estática bem-sucedida e metadados válidos. Buscas HTTPS usam limites de tempo e tamanho. Credenciais de agentes filhos são permitidas por nome de variável de ambiente; `auth.json` não é herdado.

### Diagnóstico e limites

Comece com `node dist/cli.js doctor` e `node dist/cli.js status`. Consulte [arquitetura](ARCHITECTURE.md), [migração](MIGRATION.md) e [compatibilidade](COMPATIBILITY.md) para detalhes de implementação e recuperação. O benchmark local de armazenamento não faz afirmações sobre qualidade ou custo de modelos. Veja as [evidências de aceite](ACCEPTANCE.md) e o [protocolo de benchmark](benchmarks/README.md).

### Licença

O software usa a licença MIT; consulte [LICENSE](LICENSE). O código de terceiros incluído em `src/vendor/` está listado no [aviso](src/vendor/THIRD_PARTY_NOTICES.md).
