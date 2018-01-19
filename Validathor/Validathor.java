/******************************************************************************
 *  Compilation:  javac Validathor.java
 *  Execution:    java Validathor [programyouwanttocompile.java] [path_to_output_directory]
 *
 *  Tries to compile inputed java class.
 *
 *
 ******************************************************************************/
import java.util.*;
import java.io.*;
import java.net.*;
import java.lang.reflect.Constructor;

public class Validathor {

	private static PrintWriter writer;
	private static StringBuilder errors;

	
	private static void startProcess(ProcessBuilder pb) throws IOException {
		Process p = pb.start();
		BufferedReader stdError = new BufferedReader(new InputStreamReader(p.getErrorStream()));
		String s = null;
		StringBuilder sb = new StringBuilder();
		while ((s = stdError.readLine()) != null) {
			errors.append(s);
		}
	}
	
	private static String getFileExtension(String fileName){
		String extension = "";
		if(fileName.length()>5)
		{
			int i = fileName.lastIndexOf('.');
			if(i>0) 
				extension = fileName.substring(i+1);
		}
		return extension;
	}

	private static boolean removePackageFromFiles(String algorithmDir) {
		File folder = new File(algorithmDir);
		File[] listOfFiles = folder.listFiles();
		String fileName, line, fileData;
		boolean hasPackage = false;
		for (File file : listOfFiles) {
			if (file.isFile()) {
				fileName = file.getName();
				if(getFileExtension(fileName).equals("java")) {

					try(BufferedReader br = new BufferedReader(new FileReader(file))) {
						hasPackage = false;
						fileData = "";
						while ((line = br.readLine()) != null) {
							if(line.contains("package ")) {
								hasPackage = true;
								continue;
							}
							fileData += line;
							fileData +="\n";
						}

						if(hasPackage) {
							FileWriter fw = new FileWriter(file, false);
							fw.write(fileData);
							fw.close();
						}

					} catch (Exception e) {
						errors.append("Error while removing package files in directory: "+ e.toString());
						return false;
					}

				}
			}
		}
		return true;
	}

	private static boolean hasParameterlessPublicConstructor(String algorithmDir, String algorithmName) {
		
		try{
			File f = new File(algorithmDir);
			URL[] cp = {f.toURI().toURL()};

			URLClassLoader urlcl = new URLClassLoader(cp);		
			Class<?> clazz = urlcl.loadClass(algorithmName);

			for (Constructor<?> constructor : clazz.getConstructors()) {
				// In Java 7-, use getParameterTypes and check the length of the array returned
				if (constructor.getParameterCount() == 0) { 
					return true;
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}
		
		return false;
	}

	public static void main(String[] args) {
		errors = new StringBuilder();
		if (args.length == 2) {
			String targetFile = args[1];
			String userAlgorithmFolder = new File(args[0]).getParentFile().toString();
			String userAlgorithmFilename = new File(args[0]).getName().toString();
			final File f = new File(Validathor.class.getProtectionDomain().getCodeSource().getLocation().getPath());
			String earsPath = f.getParent()+File.separator.toString();
		
			try
			{			
				File file = new File(earsPath+"config"+File.separator+"config.js");
				final Scanner scanner = new Scanner(file);
				while (scanner.hasNextLine()) 
				{
				   final String lineFromFile = scanner.nextLine();
				   if(lineFromFile.contains("earsPath")) 
				   { 
					   earsPath=lineFromFile.substring(lineFromFile.indexOf("\"")+1,lineFromFile.lastIndexOf("\""));
					   break;
				   }
				}
			}
			catch (Exception e) {
				e.printStackTrace();
				return;
			}
			
			removePackageFromFiles(userAlgorithmFolder);
			
			try 
			{
				ProcessBuilder pb = new ProcessBuilder("javac","-sourcepath",userAlgorithmFolder,"-cp",earsPath,userAlgorithmFilename);
				pb.directory(new File(userAlgorithmFolder));
				startProcess(pb);
			}
			catch (Exception e) 
			{
				e.printStackTrace();
				return;
			}

			try 
			{
				ProcessBuilder pb;
				pb = new ProcessBuilder("java","-cp",userAlgorithmFolder+File.separator,userAlgorithmFilename.substring(0, userAlgorithmFilename.lastIndexOf(".")));
			} 
			catch (Exception e) 
			{
				e.printStackTrace();
			}

			// write error if algorithm 
			if(!hasParameterlessPublicConstructor(userAlgorithmFolder,userAlgorithmFilename.substring(0, userAlgorithmFilename.lastIndexOf(".")))) {
				errors.append(" No parameterless public constructor found!");
			}
			else {
				//TODO create object and get algorithm info (author + name), @author no longer needed
				//write info to submissions file
			}

			
			try( PrintWriter out = new PrintWriter(targetFile) )
			{
				out.println("{\"error_list\": \""+errors.toString().replaceAll("\"","\\\\\"")+"\"}");
			} catch(Exception b) {}
		} else
			System.out.println(
					"Error, invalid startup. Run the program with command: \njava Validathor [programyouwanttocompile.java] [path_to_output_directory]");
	}
}
