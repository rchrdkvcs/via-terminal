//! Rust is the source of truth for every IPC wire type; `src/ipc/bindings.ts` is generated
//! from it. The test fails when the checked-in file drifts; regenerate with
//! `UPDATE_BINDINGS=1 cargo test --manifest-path src-tauri/Cargo.toml bindings`.
use crate::{commands, error, files, layout, sessions, settings, swipe, vault};
use std::{collections::BTreeSet, path::Path};
use ts_rs::{Config, TS};

const OUTPUT: &str = "../src/ipc/bindings.ts";
const HEADER: &str = "// Generated from the Rust wire types by `UPDATE_BINDINGS=1 cargo test --manifest-path src-tauri/Cargo.toml bindings`. Do not edit.\n";

struct Bindings {
    config: Config,
    declarations: Vec<String>,
    declared: BTreeSet<String>,
    referenced: BTreeSet<String>,
}

impl Bindings {
    fn add<T: TS + 'static + ?Sized>(&mut self) -> &mut Self {
        let declaration = T::decl(&self.config);
        let docs = T::docs().unwrap_or_default();
        self.declarations
            .push(format!("{docs}export {declaration}\n"));
        assert!(
            self.declared.insert(T::ident(&self.config)),
            "{} is declared twice",
            T::ident(&self.config)
        );
        for dependency in T::dependencies(&self.config) {
            self.referenced.insert(dependency.ts_name);
        }
        self
    }
}

fn generate() -> String {
    let mut bindings = Bindings {
        config: Config::new().with_large_int("number"),
        declarations: Vec::new(),
        declared: BTreeSet::new(),
        referenced: BTreeSet::new(),
    };
    bindings
        .add::<error::AppError>()
        .add::<commands::app::Bootstrap>()
        .add::<swipe::Region>()
        .add::<swipe::Phase>()
        .add::<swipe::Pan>()
        .add::<settings::Settings>()
        .add::<settings::Theme>()
        .add::<settings::CursorStyle>()
        .add::<layout::Layout>()
        .add::<layout::Sidebar>()
        .add::<layout::Space>()
        .add::<layout::Entry>()
        .add::<layout::Row>()
        .add::<layout::Tab>()
        .add::<layout::View>()
        .add::<layout::Split>()
        .add::<layout::Direction>()
        .add::<layout::Target>()
        .add::<sessions::Size>()
        .add::<sessions::shells::Shell>()
        .add::<sessions::events::SessionState>()
        .add::<sessions::events::FailureReason>()
        .add::<sessions::prompts::Prompt>()
        .add::<sessions::prompts::PromptField>()
        .add::<sessions::prompts::PromptAnswer>()
        .add::<sessions::ssh::plan::CredentialChoice>()
        .add::<commands::sessions::LocalTarget>()
        .add::<commands::emitter::Output>()
        .add::<commands::emitter::StateChanged>()
        .add::<commands::emitter::PromptPayload>()
        .add::<commands::emitter::VaultChanged>()
        .add::<vault::VaultView>()
        .add::<vault::model::VaultSnapshot>()
        .add::<vault::model::VaultData>()
        .add::<vault::model::Group>()
        .add::<vault::model::Defaults>()
        .add::<vault::model::Host>()
        .add::<vault::HostCredential>()
        .add::<vault::model::Identity>()
        .add::<vault::model::Key>()
        .add::<vault::model::KnownHost>()
        .add::<vault::resolve::Source>()
        .add::<vault::resolve::Sourced<String>>()
        .add::<vault::resolve::Effective>()
        .add::<vault::input::SecretUpdate>()
        .add::<vault::input::HostInput>()
        .add::<vault::input::GroupInput>()
        .add::<vault::input::IdentityInput>()
        .add::<vault::input::KeyImport>()
        .add::<vault::QuickTarget>()
        .add::<commands::vault::Mutation>()
        .add::<files::Owner>()
        .add::<files::model::Request>()
        .add::<files::model::Reply>()
        .add::<files::model::TransferPlan>()
        .add::<files::model::Listing>()
        .add::<files::model::Document>()
        .add::<files::model::EntryKind>()
        .add::<files::model::Entry>()
        .add::<files::model::Direction>()
        .add::<files::model::Collision>()
        .add::<files::model::TransferState>()
        .add::<files::model::TransferEvent>();

    let missing: Vec<_> = bindings.referenced.difference(&bindings.declared).collect();
    assert!(
        missing.is_empty(),
        "referenced but not declared: {missing:?}"
    );
    format!("{HEADER}\n{}", bindings.declarations.join("\n"))
}

#[test]
fn bindings_match_rust_wire_types() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(OUTPUT);
    let generated = generate();
    if std::env::var_os("UPDATE_BINDINGS").is_some() {
        std::fs::write(&path, generated).unwrap();
        return;
    }
    let current = std::fs::read_to_string(&path)
        .unwrap_or_default()
        .replace("\r\n", "\n");
    assert!(
        current == generated,
        "src/ipc/bindings.ts is out of date with the Rust wire types; regenerate with \
         `UPDATE_BINDINGS=1 cargo test --manifest-path src-tauri/Cargo.toml bindings`"
    );
}
