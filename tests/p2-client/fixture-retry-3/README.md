# TEST_ONLY P2 Client/Host fixture

Install only after reviewing docs/P2_CLIENT_TEST_PLAN.md in the owning project. This package contributes no UI, tools, presets, locale namespace or artwork. Icon/locale metadata are intentionally omitted for this disposable renderless TEST_ONLY acceptance unit, not as a product-distribution exception.

The Client runs once per page activation. A safe ordinary mainView target and Conversation panel are mandatory. Only real production Slot inject callbacks are invoked. The Host receives results through native strict Typert RemoteService, restores binding by CAS and unregisters only its unique Workspace. Files and history remain. No model prompt is submitted.

Uninstall this test package after collecting acceptance/P2-live-client.json. Do not install it in a production profile for ongoing use. Rebuild does not install or execute it.
