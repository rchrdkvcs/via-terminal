use super::{
    browsing::{CHUNK, TEXT_LIMIT},
    eof,
    model::Document,
    sftp_error, Files,
};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::OpenFlags;
impl Files {
    pub async fn read_document(&self, path: &str) -> AppResult<Document> {
        let resolved_path = self.resolve(path).await?;
        let attrs = self
            .raw
            .stat(&resolved_path)
            .await
            .map_err(sftp_error)?
            .attrs;
        if !attrs.is_regular() {
            return Err(AppError::invalid(
                "Seuls les fichiers texte ordinaires peuvent être édités",
            ));
        }
        if attrs.size.is_some_and(|n| n > TEXT_LIMIT as u64) {
            return Err(AppError::new(
                "file_too_large",
                "Ce fichier dépasse 5 Mo. Vous pouvez le télécharger",
            ));
        }
        let handle = self
            .raw
            .open(&resolved_path, OpenFlags::READ, Default::default())
            .await
            .map_err(sftp_error)?
            .handle;
        let result = self.read_text(&handle).await;
        let _ = self.raw.close(handle).await;
        Ok(Document {
            owner: self.owner.clone(),
            path: path.into(),
            resolved_path,
            content: result?,
            permissions: attrs.permissions,
            uid: attrs.uid,
            gid: attrs.gid,
        })
    }
    async fn read_text(&self, handle: &str) -> AppResult<String> {
        let mut bytes = Vec::new();
        loop {
            match self.raw.read(handle, bytes.len() as u64, CHUNK).await {
                Ok(data) => {
                    if data.data.is_empty() {
                        break;
                    }
                    bytes.extend(data.data);
                    if bytes.len() > TEXT_LIMIT {
                        return Err(AppError::new(
                            "file_too_large",
                            "Ce fichier dépasse 5 Mo. Vous pouvez le télécharger",
                        ));
                    }
                }
                Err(error) if eof(&error) => break,
                Err(error) => return Err(sftp_error(error)),
            }
        }
        let text = String::from_utf8(bytes).map_err(|_| {
            AppError::new(
                "file_encoding",
                "Ce fichier n’est pas du texte UTF-8. Vous pouvez le télécharger",
            )
        })?;
        if text.contains('\0') {
            return Err(AppError::new(
                "file_encoding",
                "Ce fichier est binaire. Vous pouvez le télécharger",
            ));
        }
        Ok(text)
    }
}
