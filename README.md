# Pi Autoskills

Pi extension that selects audited skills and playbooks for the current task and discloses only the selected content, with hash-pinned provenance.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![validate](https://github.com/Borges360/pi-autoskills/actions/workflows/validate.yml/badge.svg)](https://github.com/Borges360/pi-autoskills/actions/workflows/validate.yml)

**English** · [Português (Brasil)](#português-brasil)

| | |
| --- | --- |
| Package | `@borges360/pi-autoskills` · `0.1.2` |
| Status | Development release, not published to npm yet. Install from Git. |
| Compatibility | Node.js `>=22.19`. Peers `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` `>=1.5.2 <1.7.0`; tested against `1.6.0` only. |

## English

### What it does

Pi Autoskills discovers skills and playbooks in configured roots and trusted projects, ranks them deterministically by task keywords, paths and stack, then discloses only the selected, audited content with hash-pinned provenance. Explicit pins are respected. Optional delegation uses a synchronous ownership handshake with a specialist router.

Storage defaults to files; SQLite and Pi Durable are opt-in. The default path needs no sibling extension, remote classifier or database driver.

### Install

```sh
pi install git:github.com/Borges360/pi-autoskills
```

This installs from Git, not from the npm registry. The package metadata does not establish that the package is available on npm.

The package also provides the `pi-autoskills` CLI at `dist/cli.js`.

### Use

Run `/autoskills` (or `/autoskills config`) to open the menu. Opening it runs no command. For structured headless status, run `/autoskills status`.

The panel lists two settings, **Mode** and **Language**, followed by read-only actions. The value column shows each action's group:

| Group | Actions |
| --- | --- |
| Active | Show selected skills |
| Suggestions | Explain selection, Detect context |
| Agents | Agents |
| Settings | Doctor |

| Key | Effect |
| --- | --- |
| ↑ / ↓ | Move. |
| Enter | Edit a setting or run an action. Action results are posted to the chat. |
| Ctrl+S | Save the draft and keep the panel open. A failed save keeps the draft. |
| Esc | Go back from a list without applying, or cancel a running action or save. With unsaved changes, the first Esc warns and the second discards them and closes. |
| Ctrl+C | Left to Pi. |

- Edits are drafts until you press **Ctrl+S**.
- An action that does not finish in time (30 s; Doctor 120 s) is stopped and reported as a timeout.
- If the project storage cannot start, the menu still opens. Mode can be saved, and Doctor (also `/autoskills doctor`) reports the cause and how to recover without changing anything.
- Automated tests drive the panel with keyboard bytes at 40, 80 and 120 columns. They do not replace a review in a real terminal.

Domain actions: `show`, `detect`, `explain`, `pin <skill...>`, `pin clear`, `agents`, `delegate <agent> <objective>`, `audit <file>`, `install <file-or-https-url> <sha256> <id>` and `update <file-or-https-url> <sha256> <id>`.

Shared actions: `auto`, `off`, `observe`, `config`, `doctor`, `storage status` and `storage migrate files|sqlite|durable`.

The CLI accepts the same actions:

```sh
node dist/cli.js status
node dist/cli.js doctor
```

`install` and `update` change the selected skill root and the catalog; use them only with an explicit source and the expected SHA-256. Delegation may create child processes or worktrees. These actions were not run during the documentation checks.

### Configuration and state

| Item | Location or value |
| --- | --- |
| User settings | `~/.pi/agent/state/pi-autoskills/config.json`. `PI_ECOSYSTEM_STATE_ROOT` changes the parent directory (tests, deployment). |
| Project settings | `.pi/pi-autoskills.json`, read only after Pi trusts the project. |
| Skills | `~/.pi/agent/skills`; trusted projects may add `.pi/skills`. |
| Agent definitions | `~/.pi/agent/agents`; trusted projects may add `.pi/agents`. |
| Defaults | Mode `auto`, storage `files`, write access disabled. |

Precedence: command override, trusted project configuration, user configuration, built-in defaults. Project configuration cannot raise user security limits. All settings are in [CONFIGURATION.md](CONFIGURATION.md).

### Language

The menu starts in English. Choose **Language** to preview English or Português (Brasil) immediately. **Ctrl+S** saves the preference for the trusted project only, at `.pi/pi-autoskills.locale.json`; discarding the draft returns to the saved language. In a project Pi does not trust, the field is locked and shows why. A missing or invalid preference falls back to English. CLI actions and structured outputs keep their stable command values.

### Privacy and security

> Pi extensions run with the user's operating-system privileges. This package is not an OS sandbox.

- Selected skill content can be disclosed to the model.
- Secrets are redacted at output boundaries, but heuristics cannot detect every secret. Do not put secrets in objectives, definitions or artifacts.
- Skill installation requires an explicit source, the expected hash, a successful static audit and valid metadata. HTTPS fetches have timeout and size limits.
- Child credentials are allowlisted by environment-variable name; `auth.json` is not inherited.

The full boundary is in [SECURITY.md](SECURITY.md).

### Troubleshooting and limits

Start with `node dist/cli.js doctor` and `node dist/cli.js status`.

- Implementation and recovery: [ARCHITECTURE.md](ARCHITECTURE.md), [MIGRATION.md](MIGRATION.md), [COMPATIBILITY.md](COMPATIBILITY.md).
- Compatibility outside the tested Pi `1.6.0` has not been established.
- The local storage benchmark makes no claim about model quality or cost. See the [acceptance evidence](ACCEPTANCE.md) and the [benchmark protocol](benchmarks/README.md).

### Contributing

Install the locked dependencies from `package-lock.json`, then run the checks:

```sh
npm ci
npm test
npm run build
npm run lint
npm run benchmark
npm pack --dry-run
```

`npm run smoke:host` loads the extension with the loader of an installed Pi `1.6` release (default `~/.pi/agent/install/releases/1.6.0`, or `PI_HOST_DIR`) and renders the menu at 40, 80 and 120 columns. It requires Pi `1.6` installed locally.

The Pi extension entry point is `src/extension.ts`. Open pull requests against `develop`. See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md#reporting-a-vulnerability); do not open a public issue.

### License

MIT; see [LICENSE](LICENSE). Third-party code bundled under `src/vendor/` is listed in [its notice](src/vendor/THIRD_PARTY_NOTICES.md).

## Português (Brasil)

### O que faz

O Pi Autoskills descobre skills e playbooks em raízes configuradas e projetos confiáveis, classifica os resultados de forma determinística por palavras-chave, caminhos e stack e revela somente o conteúdo selecionado e auditado, com proveniência vinculada por hash. Pins explícitos são respeitados. A delegação opcional usa uma confirmação síncrona de propriedade com um roteador especialista.

O armazenamento usa arquivos por padrão; SQLite e Pi Durable são opcionais. O caminho padrão não exige extensão irmã, classificador remoto nem driver de banco de dados.

### Instalação

```sh
pi install git:github.com/Borges360/pi-autoskills
```

Esse comando instala a partir do Git, não da registry npm. Os metadados do pacote não comprovam que ele esteja disponível no npm.

O pacote também oferece a CLI `pi-autoskills` em `dist/cli.js`.

### Uso

Execute `/autoskills` (ou `/autoskills config`) para abrir o menu. Abrir o menu não executa nenhum comando. Para o estado estruturado em modo headless, execute `/autoskills status`.

O painel lista duas configurações, **Modo** e **Idioma**, seguidas das ações somente leitura. A coluna de valor mostra o grupo de cada ação:

| Grupo | Ações |
| --- | --- |
| Ativas | Exibir skills selecionadas |
| Sugestões | Explicar seleção, Detectar contexto |
| Agentes | Agentes |
| Configurações | Diagnóstico |

| Tecla | Efeito |
| --- | --- |
| ↑ / ↓ | Navega. |
| Enter | Edita uma configuração ou executa uma ação. Os resultados vão para o chat. |
| Ctrl+S | Salva o rascunho e mantém o painel aberto. Uma falha ao salvar preserva o rascunho. |
| Esc | Volta de uma lista sem aplicar ou cancela uma ação ou um salvamento em andamento. Com alterações não salvas, o primeiro Esc avisa e o segundo descarta e fecha. |
| Ctrl+C | Continua com o Pi. |

- Edições são rascunho até você pressionar **Ctrl+S**.
- Uma ação que não termina a tempo (30 s; Diagnóstico 120 s) é interrompida e informada como tempo esgotado.
- Se o armazenamento do projeto não puder ser iniciado, o menu ainda abre. O Modo pode ser salvo, e o Diagnóstico (também `/autoskills doctor`) informa a causa e como recuperar, sem alterar nada.
- Os testes automatizados dirigem o painel por bytes de teclado em 40, 80 e 120 colunas. Eles não substituem uma revisão num terminal real.

Ações de domínio: `show`, `detect`, `explain`, `pin <skill...>`, `pin clear`, `agents`, `delegate <agent> <objective>`, `audit <file>`, `install <file-or-https-url> <sha256> <id>` e `update <file-or-https-url> <sha256> <id>`.

Ações compartilhadas: `auto`, `off`, `observe`, `config`, `doctor`, `storage status` e `storage migrate files|sqlite|durable`.

A CLI aceita as mesmas ações:

```sh
node dist/cli.js status
node dist/cli.js doctor
```

`install` e `update` alteram a raiz de skills escolhida e o catálogo; use essas ações somente com origem explícita e o SHA-256 esperado. A delegação pode criar processos filhos ou worktrees. Essas ações não foram executadas nas verificações da documentação.

### Configuração e estado

| Item | Local ou valor |
| --- | --- |
| Preferências do usuário | `~/.pi/agent/state/pi-autoskills/config.json`. `PI_ECOSYSTEM_STATE_ROOT` altera o diretório pai (testes, implantação). |
| Configuração do projeto | `.pi/pi-autoskills.json`, lida só depois que o Pi confia no projeto. |
| Skills | `~/.pi/agent/skills`; projetos confiáveis podem adicionar `.pi/skills`. |
| Definições de agentes | `~/.pi/agent/agents`; projetos confiáveis podem adicionar `.pi/agents`. |
| Padrões | Modo `auto`, armazenamento `files`, acesso de escrita desabilitado. |

Precedência: override do comando, configuração de projeto confiável, configuração do usuário, padrões internos. A configuração do projeto não pode elevar limites de segurança do usuário. Todas as opções estão em [CONFIGURATION.md](CONFIGURATION.md).

### Idioma

O menu começa em inglês. Escolha **Idioma** para pré-visualizar inglês ou português (Brasil) na hora. **Ctrl+S** salva a preferência somente para o projeto confiável, em `.pi/pi-autoskills.locale.json`; descartar o rascunho volta ao idioma salvo. Em um projeto que o Pi não considera confiável, o campo fica bloqueado e mostra o motivo. Uma preferência ausente ou inválida volta para o inglês. As ações da CLI e as saídas estruturadas mantêm seus valores estáveis.

### Privacidade e segurança

> Extensões Pi executam com os privilégios do usuário no sistema operacional. Este pacote não é um sandbox do sistema.

- O conteúdo de skills selecionadas pode ser revelado ao modelo.
- Segredos são redigidos nas saídas, mas heurísticas não detectam todos os segredos. Não coloque segredos em objetivos, definições ou artefatos.
- A instalação de skills exige origem explícita, o hash esperado, auditoria estática bem-sucedida e metadados válidos. Buscas HTTPS têm limites de tempo e tamanho.
- Credenciais de agentes filhos são permitidas por nome de variável de ambiente; `auth.json` não é herdado.

A fronteira completa está em [SECURITY.md](SECURITY.md).

### Diagnóstico e limites

Comece com `node dist/cli.js doctor` e `node dist/cli.js status`.

- Implementação e recuperação: [ARCHITECTURE.md](ARCHITECTURE.md), [MIGRATION.md](MIGRATION.md), [COMPATIBILITY.md](COMPATIBILITY.md).
- A compatibilidade fora do Pi `1.6.0` testado não foi comprovada.
- O benchmark local de armazenamento não faz afirmações sobre qualidade ou custo de modelos. Veja as [evidências de aceite](ACCEPTANCE.md) e o [protocolo de benchmark](benchmarks/README.md).

### Contribuição

Instale as dependências travadas em `package-lock.json` e execute as verificações:

```sh
npm ci
npm test
npm run build
npm run lint
npm run benchmark
npm pack --dry-run
```

`npm run smoke:host` carrega a extensão com o loader de uma versão instalada do Pi `1.6` (padrão `~/.pi/agent/install/releases/1.6.0`, ou `PI_HOST_DIR`) e renderiza o menu em 40, 80 e 120 colunas. Exige o Pi `1.6` instalado localmente.

A entrada da extensão Pi é `src/extension.ts`. Abra pull requests para `develop`. Consulte [CONTRIBUTING.md](CONTRIBUTING.md). Relate vulnerabilidades de forma privada, como descrito em [SECURITY.md](SECURITY.md#relato-de-vulnerabilidade); não abra issue pública.

### Licença

MIT; consulte [LICENSE](LICENSE). O código de terceiros incluído em `src/vendor/` está listado no [aviso](src/vendor/THIRD_PARTY_NOTICES.md).
