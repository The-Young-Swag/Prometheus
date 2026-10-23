# Prometheus — Local Inference Environment

**Document purpose:** Record the verified local hardware, Ollama installation, model configuration, and initial inference tests for Prometheus development.

**Status:** Initial baseline established  
**Last verified:** 23 October 2026  
**Environment:** Windows 11 host; Prometheus development repository is maintained separately in a Docker-based development container.

## 1. Hardware and Host Environment

| Item | Verified value |
|---|---|
| Laptop model | Acer/ASUS model not conclusively verified in this session; device identifier previously reported as AN-515-55 |
| GPU | NVIDIA GeForce GTX 1650 Ti |
| Dedicated GPU memory | 4,096 MiB (4 GB) |
| NVIDIA driver version | 610.47 |
| CUDA user-mode driver version reported by `nvidia-smi` | 13.3 |
| System RAM | 15.8 GB detected (approximately 16 GB installed) |
| GPU driver model | WDDM |
| Operating system | Windows PowerShell environment; Windows 11 was previously reported |

The `AN-515-55` identifier and laptop manufacturer have not been independently verified here. The GPU and memory values above are taken from the user's command output.

### GPU memory snapshot before model testing

The initial `nvidia-smi` output reported **879 MiB / 4,096 MiB** GPU memory in use, with 3% GPU utilization. Windows desktop applications were using some GPU memory before inference began.

## 2. Ollama Installation

| Item | Verified value |
|---|---|
| Installation method | PowerShell command using the official Ollama install script |
| Installer command | `irm https://ollama.com/install.ps1 \| iex` |
| Installation result | `Install complete. Run 'ollama' from the command line.` |
| Ollama CLI version | `0.40.9` |
| Host API endpoint tested | `http://localhost:11434` |
| API endpoint tested | `POST http://localhost:11434/api/generate` |

Ollama was installed on the **Windows host**, not inside the Prometheus development container. This is intentional so Ollama can use the host's NVIDIA GPU without requiring the application container to own the model runtime.

The local API was successfully reached from Windows PowerShell. Access from inside the devcontainer has **not yet been configured or verified**. Inside a container, `localhost` ordinarily refers to the container itself, not the Windows host; connectivity must be tested and configured separately.

## 3. Model Configuration

| Item | Verified value |
|---|---|
| Model tag | `qwen2.5:1.5b` |
| Ollama model ID | `65ec06548149` (reported by `ollama ps`) |
| Downloaded model blob | Approximately 986 MB, plus small metadata/support blobs |
| Reported loaded model size | 1.2 GB (`ollama ps`) |
| Reported processor placement | `100% GPU` |
| Reported context length | 4,096 tokens |
| Runner | `llamacpp` |

The downloaded blob size and the loaded model size reported by Ollama are different measurements and should not be treated as contradictory. Actual memory use also includes runtime and context-related allocations.

### Confirmed GPU execution

The command `ollama ps` returned the following relevant values:

```text
NAME            SIZE      PROCESSOR    CONTEXT    RUNNER
qwen2.5:1.5b    1.2 GB    100% GPU     4096       llamacpp
```

This confirms that Ollama reported the model as fully GPU-resident at the time of the check. It does not, by itself, establish generation throughput, latency under load, or remaining VRAM headroom.

## 4. Initial Inference Tests

### 4.1 Interactive CLI test

The model was started successfully with:

```powershell
ollama run qwen2.5:1.5b
```

Given a request to extract an event from “Remind me to study Express.js tomorrow at 7 PM,” the model returned the expected action and fields when instructed with an example JSON structure. Its response was wrapped in a Markdown JSON code fence, demonstrating that prompt instructions alone do not guarantee raw JSON output.

### 4.2 HTTP API test

The following endpoint was tested successfully from Windows PowerShell:

```text
POST http://localhost:11434/api/generate
```

A request using `stream = false` returned a completed response with `done: True`. Without a supplied schema, the model returned:

```json
{
  "action": "study",
  "title": "Express.js"
}
```

This output was syntactically JSON but did not conform to the intended Prometheus action contract: the action value was incorrect and required scheduling fields were missing.

### 4.3 JSON-schema-constrained output test

A subsequent request supplied a JSON schema using the Ollama API's `format` field. The response was parsed successfully in PowerShell and contained:

```json
{
  "title": "Study Express.js",
  "when_text": "tomorrow at 7 PM",
  "action": "create_event",
  "duration_min": 60
}
```

This is a successful initial structured-output test. It is a single test case, not evidence of broad reliability or production readiness.

## 5. Implications for Prometheus Architecture

The initial experiment supports using Ollama as the local inference runtime for early Prometheus development. The application should still treat all model output as untrusted input.

Recommended request flow:

1. The frontend sends a user request to the Prometheus backend.
2. The backend calls the local Ollama API.
3. Ollama returns a proposed structured action.
4. The backend parses the response and validates it with the shared Zod schema.
5. Application code resolves dates and times deterministically, applies authorization/confirmation rules, and executes only explicitly permitted actions.
6. Invalid or ambiguous outputs are rejected or sent through a clarification path; they must not be executed.

For event extraction, preserve the original natural-language phrase (for example, `when_text: "tomorrow at 7 PM"`) and resolve it in application code using a deterministic date-parsing library. Do not rely on the model alone to calculate the final timestamp.

Use Ollama's structured-output/schema feature to constrain the response format, but do not treat it as a replacement for backend validation. A response can have the correct JSON shape and still be semantically wrong, ambiguous, or unsuitable for execution.

## 6. Known Limitations and Outstanding Checks

- Only a small number of manual prompts have been tested; no formal evaluation dataset or accuracy benchmark exists yet.
- Inference latency and tokens per second have not been benchmarked.
- GPU usage was confirmed through `ollama ps`, but a simultaneous post-inference `nvidia-smi` memory snapshot has not been recorded.
- The model's context length is currently reported as 4,096 tokens; larger contexts may increase memory use.
- Connectivity from the Docker devcontainer to the Windows-hosted Ollama API is not yet verified.
- The Ollama CLI version is recorded as `0.40.9` from the installation session; check `ollama --version` before relying on this version in future troubleshooting.
- The Windows API should remain local to the development machine and must not be exposed publicly without a deliberate security design.
- The model has not been fine-tuned. This model and configuration form the initial baseline against which future prompts, schemas, models, or fine-tuned variants can be evaluated.

## 7. Useful Verification Commands

Run these commands in Windows PowerShell unless otherwise stated.

### Check Ollama version

```powershell
ollama --version
```

### List downloaded models

```powershell
ollama list
```

### Check currently loaded models and processor placement

```powershell
ollama ps
```

### Check GPU and VRAM usage

```powershell
nvidia-smi
```

### Check the local Ollama API

```powershell
Invoke-RestMethod http://localhost:11434/api/tags
```

### Generate a non-streaming response with a schema

The request body should include the model tag, prompt, `stream = $false`, and a JSON schema in the `format` field. In PowerShell, use `ConvertTo-Json -Depth 10` when serializing nested schema objects.

## 8. Current Baseline Summary

- **Host inference:** Working.
- **Model:** `qwen2.5:1.5b` downloaded and runnable.
- **GPU acceleration:** Confirmed by Ollama reporting `100% GPU`.
- **Local HTTP API:** Working from Windows PowerShell.
- **Schema-constrained JSON:** Successful in one manual event-extraction test.
- **Backend integration:** Not yet implemented.
- **Zod validation and safe action execution:** Not yet implemented.
- **Container-to-host API connectivity:** Not yet verified.
- **Fine-tuning/evaluation:** Not yet started.
