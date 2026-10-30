package com.sontrix.player

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ScrollView
import androidx.documentfile.provider.DocumentFile
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var songsContainer: LinearLayout
    private lateinit var status: TextView
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private val songs = mutableListOf<Song>()

    data class Song(val uri: String, val title: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loadSongs()
        buildInterface()

        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        val future = MediaController.Builder(this, token).buildAsync()
        controllerFuture = future
        future.addListener({
            try {
                controller = future.get()
                status.text = "Player pronto. Você pode sair do app enquanto a música toca."
            } catch (error: Exception) {
                status.text = "Não foi possível iniciar o player: ${error.message}"
            }
        }, mainExecutor)
    }

    private fun buildInterface() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 36, 28, 24)
            setBackgroundColor(0xFF111111.toInt())
        }

        root.addView(TextView(this).apply {
            text = "♫ Sontrix"
            textSize = 30f
            setTextColor(0xFFFF4545.toInt())
        })
        root.addView(TextView(this).apply {
            text = "Sua música, no seu ritmo"
            textSize = 16f
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, 8, 0, 24)
        })
        root.addView(Button(this).apply {
            text = "＋ Adicionar músicas"
            setOnClickListener { openAudioPicker() }
        })
        root.addView(Button(this).apply {
            text = "▣ Importar pasta de músicas"
            setOnClickListener { openFolderPicker() }
        })
        root.addView(Button(this).apply {
            text = "⏯ Reproduzir / pausar"
            setOnClickListener {
                controller?.let { player ->
                    if (player.isPlaying) player.pause() else player.play()
                } ?: run { status.text = "Aguarde o player iniciar." }
            }
        })

        status = TextView(this).apply {
            text = "Iniciando player..."
            textSize = 14f
            setTextColor(0xFFCCCCCC.toInt())
            setPadding(0, 12, 0, 12)
        }
        root.addView(status)
        root.addView(TextView(this).apply {
            text = "Sua biblioteca"
            textSize = 21f
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, 12, 0, 8)
        })

        songsContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val scroll = ScrollView(this).apply { addView(songsContainer) }
        root.addView(scroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        setContentView(root)
        renderSongs()
    }

    private fun openAudioPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "audio/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(intent, REQUEST_PICK_AUDIO)
    }

    private fun openFolderPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(intent, REQUEST_PICK_FOLDER)
    }

    @Deprecated("Uses activity result API for broad Android compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data?.data == null) return

        when (requestCode) {
            REQUEST_PICK_AUDIO -> importSelectedAudio(data)
            REQUEST_PICK_FOLDER -> importAudioFolder(data.data!!, data.flags)
        }
    }

    private fun importSelectedAudio(data: Intent) {
        val selected = mutableListOf<Uri>()
        data.clipData?.let { clip ->
            for (index in 0 until clip.itemCount) selected.add(clip.getItemAt(index).uri)
        }
        data.data?.let { if (selected.isEmpty()) selected.add(it) }

        selected.forEach { uri ->
            try {
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (_: SecurityException) {
                // Alguns provedores não permitem persistir a autorização.
            }
            addSong(uri)
        }
        saveSongs()
        renderSongs()
        status.text = "${selected.size} arquivo(s) selecionado(s)."
    }

    private fun importAudioFolder(folderUri: Uri, resultFlags: Int) {
        val readPermission = resultFlags and Intent.FLAG_GRANT_READ_URI_PERMISSION
        try {
            contentResolver.takePersistableUriPermission(folderUri, readPermission)
        } catch (_: SecurityException) {
            status.text = "Não foi possível manter acesso à pasta selecionada."
            return
        }

        val folder = DocumentFile.fromTreeUri(this, folderUri)
        if (folder == null || !folder.isDirectory) {
            status.text = "Não foi possível abrir essa pasta."
            return
        }

        val before = songs.size
        importAudioFilesRecursively(folder)
        val added = songs.size - before
        saveSongs()
        renderSongs()
        status.text = if (added > 0) {
            "$added música(s) importada(s) da pasta."
        } else {
            "Nenhum arquivo de áudio novo foi encontrado nessa pasta."
        }
    }

    private fun importAudioFilesRecursively(directory: DocumentFile) {
        directory.listFiles().forEach { file ->
            if (file.isDirectory) {
                importAudioFilesRecursively(file)
            } else if (file.isFile && file.type?.startsWith("audio/") == true) {
                addSong(file.uri)
            }
        }
    }

    private fun addSong(uri: Uri) {
        val uriText = uri.toString()
        if (songs.none { it.uri == uriText }) {
            songs.add(Song(uriText, getDisplayName(uri)))
        }
    }

    private fun getDisplayName(uri: Uri): String {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) return cursor.getString(index)
            }
        }
        return uri.lastPathSegment ?: "Áudio"
    }

    private fun renderSongs() {
        songsContainer.removeAllViews()
        if (songs.isEmpty()) {
            songsContainer.addView(TextView(this).apply {
                text = "Nenhuma música adicionada ainda."
                textSize = 15f
                setTextColor(0xFFBBBBBB.toInt())
            })
            return
        }
        songs.forEachIndexed { index, song ->
            songsContainer.addView(Button(this).apply {
                text = "♫  ${song.title}"
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setOnClickListener { playSong(index) }
            })
        }
    }

    private fun playSong(index: Int) {
        val player = controller
        if (player == null) {
            status.text = "O player ainda está iniciando. Tente novamente."
            return
        }
        val song = songs.getOrNull(index) ?: return
        val metadata = MediaMetadata.Builder().setTitle(song.title).build()
        player.setMediaItem(MediaItem.Builder()
            .setUri(Uri.parse(song.uri))
            .setMediaMetadata(metadata)
            .build())
        player.prepare()
        player.play()
        status.text = "Tocando: ${song.title}"
    }

    private fun loadSongs() {
        val json = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SONGS, "[]") ?: "[]"
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                songs.add(Song(item.getString("uri"), item.getString("title")))
            }
        } catch (_: Exception) {
            songs.clear()
        }
    }

    private fun saveSongs() {
        val array = JSONArray()
        songs.forEach { song -> array.put(JSONObject().put("uri", song.uri).put("title", song.title)) }
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SONGS, array.toString()).apply()
    }

    override fun onDestroy() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_PICK_AUDIO = 1001
        private const val REQUEST_PICK_FOLDER = 1002
        private const val PREFS = "sontrix_library"
        private const val KEY_SONGS = "songs"
    }
}
