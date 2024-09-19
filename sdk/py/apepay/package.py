from importlib import resources

from ape.managers.project import ProjectManager

root = resources.files(__package__)

with resources.as_file(root.joinpath("manifest.json")) as manifest_json_file:
    MANIFEST = ProjectManager.from_manifest(manifest_json_file)
